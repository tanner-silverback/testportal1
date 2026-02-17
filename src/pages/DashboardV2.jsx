import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, FileText, Plus, Clock, CheckCircle2, AlertCircle, 
  Phone, Mail, Calendar, Home, ChevronRight, Info, Zap, MessageCircle, Edit2, Check, X, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import CoverageCheckerDialog from '../components/dashboard/CoverageCheckerDialog';
import SubmitClaimDialog from '../components/dashboard/SubmitClaimDialog';
import RenewalNotificationDialog from '../components/dashboard/RenewalNotificationDialog';
import PolicyActionButtons from '../components/dashboard/PolicyActionButtons';

const statusColors = {
  'Active': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Expired': 'bg-slate-100 text-slate-600 border-slate-200',
  'Cancelled': 'bg-red-100 text-red-700 border-red-200',
  'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
  'Active Pending Payment': 'bg-orange-100 text-orange-800 border-orange-200',
  'Approved': 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Denied': 'bg-red-100 text-red-700 border-red-200',
};

export default function DashboardV2() {
  const [user, setUser] = useState(null);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [submitClaimDialogOpen, setSubmitClaimDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [mainView, setMainView] = useState('properties');
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalPolicy, setRenewalPolicy] = useState(null);
  const [hasShownRenewalDialog, setHasShownRenewalDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setPhoneValue(currentUser?.phone || '');
      setEmailValue(currentUser?.email || '');
    };
    loadUser();
  }, []);

  const updatePhoneMutation = useMutation({
    mutationFn: (phone) => base44.auth.updateMe({ phone }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setEditingPhone(false);
      queryClient.invalidateQueries(['policies']);
      queryClient.invalidateQueries(['claims']);
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const viewAsEmail = urlParams.get('viewAsEmail');
  const emailToFetch = viewAsEmail || user?.email;

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies', emailToFetch],
    queryFn: () => base44.entities.Policy.filter({ customer_email: emailToFetch }),
    enabled: !!emailToFetch,
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['claims', emailToFetch],
    queryFn: () => base44.entities.Claim.filter({ customer_email: emailToFetch }),
    enabled: !!emailToFetch,
  });

  useEffect(() => {
    const handleOpenCoverageChecker = () => setCoverageDialogOpen(true);
    const handleOpenSubmitClaim = () => setSubmitClaimDialogOpen(true);
    window.addEventListener('openCoverageChecker', handleOpenCoverageChecker);
    window.addEventListener('openSubmitClaim', handleOpenSubmitClaim);
    return () => {
      window.removeEventListener('openCoverageChecker', handleOpenCoverageChecker);
      window.removeEventListener('openSubmitClaim', handleOpenSubmitClaim);
    };
  }, []);

  // Check for renewal notification on login
  useEffect(() => {
    if (!hasShownRenewalDialog && policies.length > 0) {
      // Find policy expiring within 60 days
      const policyNeedingRenewal = policies.find(p => {
        if (p.policy_status !== 'Active') return false;
        const expirationDate = p.expiration_date ? parseISO(p.expiration_date) : null;
        if (!expirationDate) return false;
        const daysUntilExpiration = differenceInDays(expirationDate, new Date());
        return daysUntilExpiration <= 60 && daysUntilExpiration > 0;
      });

      if (policyNeedingRenewal) {
        setRenewalPolicy(policyNeedingRenewal);
        setRenewalDialogOpen(true);
        setHasShownRenewalDialog(true);
      }
    }
  }, [policies, hasShownRenewalDialog]);

  if (!user || policiesLoading || claimsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          <p className="mt-4 text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Group policies by property
  const propertiesByAddress = {};
  policies.forEach(policy => {
    const address = policy.property_address || 'No Address';
    if (!propertiesByAddress[address]) {
      propertiesByAddress[address] = [];
    }
    propertiesByAddress[address].push(policy);
  });

  // Get active policies
  const activePolicies = policies.filter(p => p.policy_status === 'Active');
  const activePolicy = activePolicies[0];

  // Get active and past claims
  const activeClaims = claims.filter(c => 
    ['Active', 'Approved', 'In Progress', 'Pending'].includes(c.claim_status)
  );
  const pastClaims = claims.filter(c => 
    ['Completed', 'Denied', 'Cancelled'].includes(c.claim_status)
  );

  // Get past policies
  const pastPolicies = policies.filter(p => 
    ['Expired', 'Cancelled'].includes(p.policy_status)
  );

  // Check for urgent items
  const urgentItems = [];
  
  if (activePolicy) {
    const expirationDate = activePolicy.expiration_date ? parseISO(activePolicy.expiration_date) : null;
    if (expirationDate) {
      const daysUntilExpiration = differenceInDays(expirationDate, new Date());
      if (daysUntilExpiration <= 30 && daysUntilExpiration > 0) {
        urgentItems.push({
          type: 'renewal',
          title: 'Policy Renewal Due Soon',
          description: `Your policy expires in ${daysUntilExpiration} days. Renew now to avoid coverage gaps.`,
          action: 'Renew Policy',
          actionUrl: 'https://silverbackhw.com/order-policy',
          priority: daysUntilExpiration <= 7 ? 'high' : 'medium'
        });
      }
    }
  }

  const pendingClaims = claims.filter(c => c.claim_status === 'Pending');
  if (pendingClaims.length > 0) {
    urgentItems.push({
      type: 'claim',
      title: `${pendingClaims.length} Pending Claim${pendingClaims.length > 1 ? 's' : ''}`,
      description: 'We\'re reviewing your claim and will update you soon.',
      priority: 'medium'
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* A/B Test Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 text-center">
        <p className="text-sm font-medium">
          📊 You're viewing the new dashboard design. 
          <a 
            href="/Dashboard" 
            className="ml-2 underline font-semibold hover:text-emerald-100"
          >
            ← Back to Classic Version
          </a>
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {user.full_name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-500" />
              {editingPhone ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="Phone number"
                    className="h-8 w-40"
                  />
                  <Button
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updatePhoneMutation.mutate(phoneValue)}
                    disabled={updatePhoneMutation.isPending}
                  >
                    {updatePhoneMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneValue(user?.phone || '');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPhone(true)}
                  className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  {user.phone || 'Add phone'}
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-600">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Urgent Alerts */}
        {urgentItems.length > 0 && (
          <div className="mb-8 space-y-3">
            {urgentItems.map((item, idx) => (
              <Alert 
                key={idx} 
                className={`border-l-4 ${
                  item.priority === 'high' 
                    ? 'border-l-red-500 bg-red-50' 
                    : 'border-l-amber-500 bg-amber-50'
                }`}
              >
                <AlertCircle className={`h-5 w-5 ${
                  item.priority === 'high' ? 'text-red-600' : 'text-amber-600'
                }`} />
                <AlertDescription className="ml-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-slate-700 text-sm mt-1">{item.description}</p>
                    </div>
                    {item.actionUrl && (
                      <Button 
                        size="sm" 
                        className="ml-4 shrink-0"
                        onClick={() => window.open(item.actionUrl, '_blank')}
                      >
                        {item.action}
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Active Coverage</p>
                  <p className="text-3xl font-bold text-slate-900">{activePolicies.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {activePolicies.length === 1 ? 'policy' : 'policies'}
                  </p>
                </div>
                <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Active Claims</p>
                  <p className="text-3xl font-bold text-slate-900">{activeClaims.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    being processed
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Claims</p>
                  <p className="text-3xl font-bold text-slate-900">{claims.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    all time
                  </p>
                </div>
                <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Primary Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Policy */}
            {activePolicy ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm opacity-90 mb-1">Current Coverage</p>
                      <h3 className="text-2xl font-bold mb-2">{activePolicy.policy_name}</h3>
                      <p className="text-sm opacity-90">Policy #{activePolicy.policy_number}</p>
                    </div>
                    <Badge className="bg-emerald-500 text-white border-0">
                      Active
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Effective Date</p>
                      <p className="font-semibold text-slate-900">
                        {activePolicy.effective_date ? format(parseISO(activePolicy.effective_date), 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Expires</p>
                      <p className="font-semibold text-slate-900">
                        {activePolicy.expiration_date ? format(parseISO(activePolicy.expiration_date), 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {activePolicy.property_address && (
                    <div className="mb-6">
                      <p className="text-xs text-slate-500 mb-1">Property</p>
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-slate-400" />
                        <p className="font-semibold text-slate-900">{activePolicy.property_address}</p>
                      </div>
                    </div>
                  )}
                  {activePolicy.add_ons && activePolicy.add_ons.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Add-ons</p>
                      <div className="flex flex-wrap gap-2">
                        {activePolicy.add_ons.map((addon, idx) => (
                          <Badge key={idx} variant="outline" className="bg-slate-50">
                            {addon}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <PolicyActionButtons policy={activePolicy} />
                  <div className="mt-6 pt-6 border-t">
                    <Button 
                      className="w-full"
                      onClick={() => window.open('https://workdrive.zohoexternal.com/external/9aebbd4d42bb52ecbe0f404bb482dd2532d647030075bb3872824f52ced98b51', '_blank')}
                    >
                      View Full Contract
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Active Policy</h3>
                  <p className="text-slate-600 mb-6">Get coverage for your home today</p>
                  <Button 
                    size="lg"
                    onClick={() => window.open('https://silverbackhw.com/order-policy', '_blank')}
                  >
                    Get a Quote
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Claims Section with Tabs */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b">
                <CardTitle>Claims</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="active">
                      Active ({activeClaims.length})
                    </TabsTrigger>
                    <TabsTrigger value="past">
                      Past ({pastClaims.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="space-y-4 mt-0">
                    {activeClaims.length > 0 ? (
                      activeClaims.map((claim) => (
                        <div 
                          key={claim.id} 
                          className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-slate-900">{claim.claim_name}</p>
                              <Badge className={statusColors[claim.claim_status] || 'bg-slate-100'}>
                                {claim.claim_status}
                              </Badge>
                            </div>
                            {claim.claim_type && (
                              <p className="text-sm text-slate-600 mb-1">{claim.claim_type}</p>
                            )}
                            {claim.contractor && (
                              <p className="text-xs text-slate-500">
                                Contractor: {claim.contractor}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No active claims</p>
                    )}
                  </TabsContent>

                  <TabsContent value="past" className="space-y-4 mt-0">
                    {pastClaims.length > 0 ? (
                      pastClaims.map((claim) => (
                        <div 
                          key={claim.id} 
                          className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-slate-900">{claim.claim_name}</p>
                              <Badge className={statusColors[claim.claim_status] || 'bg-slate-100'}>
                                {claim.claim_status}
                              </Badge>
                            </div>
                            {claim.claim_type && (
                              <p className="text-sm text-slate-600 mb-1">{claim.claim_type}</p>
                            )}
                            {claim.claim_date && (
                              <p className="text-xs text-slate-500">
                                {format(parseISO(claim.claim_date), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No past claims</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setSubmitClaimDialogOpen(true)}
                  disabled={activePolicies.length === 0}
                  className="w-full justify-start h-auto py-3 bg-slate-900 hover:bg-slate-800"
                >
                  <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center mr-3">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">File a Claim</p>
                    <p className="text-xs opacity-80">Quick & easy</p>
                  </div>
                </Button>

                <Button
                  onClick={() => setCoverageDialogOpen(true)}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                    <CheckCircle2 className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Check Coverage</p>
                    <p className="text-xs text-slate-600">What's included</p>
                  </div>
                </Button>

                <Button
                  onClick={() => window.open('https://silverbackhw.com/order-policy', '_blank')}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                    <Shield className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Buy New Policy</p>
                    <p className="text-xs text-slate-600">Add coverage</p>
                  </div>
                </Button>

                <Button
                  onClick={() => window.location.href = '/Inbox'}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                    <MessageCircle className="h-5 w-5 text-slate-700" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Contact Us</p>
                    <p className="text-xs text-slate-600">Get help</p>
                  </div>
                </Button>

                <a 
                  href="tel:8016868927"
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all border border-blue-200"
                >
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Call Us Now</p>
                    <p className="text-xs text-slate-600">(801) 686-8927</p>
                  </div>
                </a>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Did You Know?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Most claims are processed within 24-48 hours. Make sure to include photos and details for faster processing.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    You can renew your policy up to 60 days before it expires to ensure continuous coverage.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Properties and Past Policies Toggle */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Coverage History</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="properties" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="properties">
                      Properties ({Object.keys(propertiesByAddress).length})
                    </TabsTrigger>
                    <TabsTrigger value="past">
                      Past Policies ({pastPolicies.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="properties" className="space-y-3 mt-0">
                    {Object.keys(propertiesByAddress).length > 0 ? (
                      Object.entries(propertiesByAddress).map(([address, props]) => (
                        <div 
                          key={address}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center">
                            <Home className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{address}</p>
                            <p className="text-xs text-slate-600">{props.length} {props.length === 1 ? 'policy' : 'policies'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No properties</p>
                    )}
                  </TabsContent>

                  <TabsContent value="past" className="space-y-3 mt-0">
                    {pastPolicies.length > 0 ? (
                      pastPolicies.map((policy) => (
                        <div 
                          key={policy.id}
                          className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-slate-900 text-sm">
                              {policy.policy_name}
                            </p>
                            <Badge className={statusColors[policy.policy_status] || 'bg-slate-100'}>
                              {policy.policy_status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mb-1">#{policy.policy_number}</p>
                          {policy.expiration_date && (
                            <p className="text-xs text-slate-500">
                              Expired: {format(parseISO(policy.expiration_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No past policies</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CoverageCheckerDialog 
        open={coverageDialogOpen}
        onOpenChange={setCoverageDialogOpen}
      />

      <SubmitClaimDialog
        open={submitClaimDialogOpen}
        onOpenChange={setSubmitClaimDialogOpen}
        policies={policies}
      />

      <RenewalNotificationDialog
        open={renewalDialogOpen}
        onOpenChange={setRenewalDialogOpen}
        policy={renewalPolicy}
      />
    </div>
  );
}