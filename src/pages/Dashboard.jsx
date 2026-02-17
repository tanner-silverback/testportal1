import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { Loader2, Shield, FileText, Calendar, CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronDown, MapPin, Plus, MessageCircle, X, Phone, Mail, User as UserIcon, Edit2, Check, CreditCard, Eye, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import PropertyPolicyGroup from '../components/dashboard/PropertyPolicyGroup';
import ContactDialog from '../components/dashboard/ContactDialog';
import CoverageCheckerDialog from '../components/dashboard/CoverageCheckerDialog';
import SubmitClaimDialog from '../components/dashboard/SubmitClaimDialog';
import PolicyActionButtons from '../components/dashboard/PolicyActionButtons';
import ClaimCancellationDialog from '../components/dashboard/ClaimCancellationDialog';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Active (Not Renewing)": "bg-amber-100 text-amber-700 border-amber-200",
  Expired: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  "Active Pending Payment": "bg-purple-100 text-purple-700 border-purple-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Denied: "bg-red-100 text-red-700 border-red-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200"
};

const normalizeStatus = (status) => {
  if (!status) return 'Pending';
  if (status === 'Do Not Renew' || status === 'Not Renewing') {
    return 'Active (Not Renewing)';
  }
  return status;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [claimFilter, setClaimFilter] = useState('all');
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [submitClaimDialogOpen, setSubmitClaimDialogOpen] = useState(false);
  const [claimCancellationDialogOpen, setClaimCancellationDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  useEffect(() => {
    const handleOpenCoverageChecker = () => setCoverageDialogOpen(true);
    const handleOpenContact = () => setContactDialogOpen(true);
    const handleOpenSubmitClaim = () => setSubmitClaimDialogOpen(true);

    window.addEventListener('openCoverageChecker', handleOpenCoverageChecker);
    window.addEventListener('openContact', handleOpenContact);
    window.addEventListener('openSubmitClaim', handleOpenSubmitClaim);

    return () => {
      window.removeEventListener('openCoverageChecker', handleOpenCoverageChecker);
      window.removeEventListener('openContact', handleOpenContact);
      window.removeEventListener('openSubmitClaim', handleOpenSubmitClaim);
    };
  }, []);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [selectedRenewalPolicy, setSelectedRenewalPolicy] = useState(null);
  const [allPoliciesExpanded, setAllPoliciesExpanded] = useState(false);
  const [allClaimsExpanded, setAllClaimsExpanded] = useState(false);
  const [renewalHistoryExpanded, setRenewalHistoryExpanded] = useState(false);
  const [policyStatusFilter, setPolicyStatusFilter] = useState('all');
  const [propertiesExpanded, setPropertiesExpanded] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setPhoneValue(currentUser?.phone || '');
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const customerEmail = user?.email;

  const { data: policies = [], isLoading: policiesLoading, error: policiesError } = useQuery({
    queryKey: ['policies', customerEmail],
    queryFn: async () => {
      if (!customerEmail) return [];
      try {
        return await base44.entities.Policy.filter({ customer_email: customerEmail });
      } catch (error) {
        console.error('Error fetching policies:', error);
        return [];
      }
    },
    enabled: !!user && !!customerEmail,
    retry: false,
    staleTime: 30000
  });

  const { data: claims = [], isLoading: claimsLoading, error: claimsError } = useQuery({
    queryKey: ['claims', customerEmail],
    queryFn: async () => {
      if (!customerEmail) return [];
      try {
        return await base44.entities.Claim.filter({ customer_email: customerEmail }, '-claim_date');
      } catch (error) {
        console.error('Error fetching claims:', error);
        return [];
      }
    },
    enabled: !!user && !!customerEmail,
    retry: false,
    staleTime: 30000
  });



  const updatePhoneMutation = useMutation({
    mutationFn: (phone) => base44.auth.updateMe({ phone }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setEditingPhone(false);
      queryClient.invalidateQueries(['policies']);
      queryClient.invalidateQueries(['claims']);
    }
  });

  // Auto-populate phone from policies/claims if user doesn't have one
  useEffect(() => {
    if (user && !user.phone && (policies.length > 0 || claims.length > 0)) {
      const phoneFromPolicy = policies.find(p => p.customer_phone)?.customer_phone;
      const phoneFromClaim = claims.find(c => c.customer_phone)?.customer_phone;
      const phone = phoneFromPolicy || phoneFromClaim;
      
      if (phone && !updatePhoneMutation.isPending) {
        updatePhoneMutation.mutate(phone);
      }
    }
  }, [user?.phone, policies.length, claims.length]);

  const isLoading = policiesLoading || claimsLoading;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Group policies by property address
  const groupPoliciesByProperty = () => {
    const groups = {};

    policies.forEach((policy) => {
      const address = policy.property_address || 'No Address Listed';
      if (!groups[address]) {
        groups[address] = [];
      }
      groups[address].push(policy);
    });

    return Object.entries(groups).map(([address, policies]) => {
      // Find the current policy (highest renewal number or most recent active)
      const sortedPolicies = [...policies].sort((a, b) => {
        const getNumber = (policyNum) => {
          const match = String(policyNum).match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        };
        return getNumber(b.policy_number) - getNumber(a.policy_number);
      });

      const currentPolicy = sortedPolicies[0];

      return {
        address,
        policies: sortedPolicies,
        currentPolicy
      };
    });
  };

  const propertyGroups = groupPoliciesByProperty();



  const selectedPolicy = selectedPolicyId ?
  policies.find((p) => p.id === selectedPolicyId) :
  propertyGroups[0]?.currentPolicy;

  useEffect(() => {
    if (propertyGroups.length > 0 && !selectedPolicyId) {
      setSelectedPolicyId(propertyGroups[0].currentPolicy.id);
    }
  }, [policies, selectedPolicyId]);

  // Get base policy number (without renewal suffix)
  const getBasePolicyNumber = (policyNumber) => {
    return String(policyNumber).replace(/-\d+$/, '');
  };

  // Get all claims for a property group (all policies with same base number)
  const getClaimsForPropertyGroup = (propertyGroup) => {
    const basePolicyNumber = getBasePolicyNumber(propertyGroup.currentPolicy.policy_number);

    const propertyClaims = claims.filter((c) => {
      if (!c.policy_id) return false;
      const claimBasePolicyNumber = getBasePolicyNumber(c.policy_id);
      return claimBasePolicyNumber === basePolicyNumber;
    });

    if (claimFilter === 'all') return propertyClaims;
    if (claimFilter === 'active') return propertyClaims.filter((c) => c.claim_status === 'Active' || c.claim_status === 'In Progress');
    if (claimFilter === 'approved') return propertyClaims.filter((c) => c.claim_status === 'Approved' || c.claim_status === 'Completed');
    return propertyClaims.filter((c) => c.claim_status === claimFilter);
  };

  const checkExpiration = (policy) => {
    if (!policy.expiration_date) return null;
    const expirationDate = new Date(policy.expiration_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 60 && daysUntilExpiry > 0) {
      return daysUntilExpiry;
    }
    return null;
  };

  const isWithinFirst30Days = (policy) => {
    if (!policy.effective_date) return false;
    const effectiveDate = new Date(policy.effective_date);
    const today = new Date();
    const daysSinceEffective = Math.ceil((today - effectiveDate) / (1000 * 60 * 60 * 24));
    return daysSinceEffective <= 30 && daysSinceEffective >= 0;
  };

  const handleViewSection = (section) => {
    // Collapse all sections first
    setPropertiesExpanded(false);
    setAllPoliciesExpanded(false);
    setAllClaimsExpanded(false);
    setRenewalHistoryExpanded(false);

    // Expand the selected section
    if (section === 'properties') {
      setPropertiesExpanded(true);
      setTimeout(() => {
        document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else if (section === 'policies') {
      setAllPoliciesExpanded(true);
      setTimeout(() => {
        document.getElementById('all-policies')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else if (section === 'claims') {
      setAllClaimsExpanded(true);
      setTimeout(() => {
        document.getElementById('claims')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>);

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* A/B Test Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 text-center">
        <p className="text-sm font-medium">
          🎨 Try our new redesigned dashboard! 
          <a 
            href="/DashboardV2" 
            className="ml-2 underline font-semibold hover:text-blue-100"
          >
            View New Version →
          </a>
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-6 flex items-center gap-4">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69443e7d41ac045a66db022e/f5a4a3ed8_SBLogo.jpg" 
            alt="SilverBack Home Warranty" 
            className="h-16 w-16 object-contain"
          />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Welcome back, {user.full_name}!
            </h1>
          </div>
        </div>

        {/* Customer Info Card */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <UserIcon className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="font-semibold text-slate-900">{user.full_name}</p>
                </div>
                </div>

                <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Mail className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-semibold text-slate-900">{user.email}</p>
                </div>
                </div>

                <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Phone className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">Phone</p>
                  {editingPhone ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        placeholder="Enter phone number"
                        className="h-8"
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => updatePhoneMutation.mutate(phoneValue)}
                        disabled={updatePhoneMutation.isPending}
                      >
                        {updatePhoneMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingPhone(false);
                          setPhoneValue(user?.phone || '');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{user.phone || 'Not set'}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setEditingPhone(true)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>



        {isLoading ?
        <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div> :
        policies.length === 0 ?
        <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                <Shield className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Active Policies</h3>
              <p className="text-slate-500">Contact us to get started with your home warranty coverage.</p>
            </CardContent>
          </Card> :

        <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card 
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewSection('properties')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <MapPin className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Properties</p>
                        <p className="text-2xl font-bold text-slate-900">{propertyGroups.length}</p>
                      </div>
                    </div>
                    <Eye className="h-5 w-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewSection('policies')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-100 rounded-lg">
                        <Shield className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Active Policies</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {propertyGroups.filter((pg) => pg.currentPolicy.policy_status === 'Active').length}
                        </p>
                      </div>
                    </div>
                    <Eye className="h-5 w-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewSection('claims')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-100 rounded-lg">
                        <FileText className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total Claims</p>
                        <p className="text-2xl font-bold text-slate-900">{claims.length}</p>
                      </div>
                    </div>
                    <Eye className="h-5 w-5 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100/50">
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <div className="p-4 bg-blue-600 rounded-xl w-fit mx-auto">
                      <Shield className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Order New Policy</h3>
                      <p className="text-xs text-slate-600">Coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-amber-50 to-amber-100/50"
                onClick={() => setSubmitClaimDialogOpen(true)}
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <div className="p-4 bg-amber-600 rounded-xl w-fit mx-auto">
                      <FileText className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Submit New Claim</h3>
                      <p className="text-xs text-slate-600">File a claim</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100/50"
                onClick={() => setCoverageDialogOpen(true)}
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <div className="p-4 bg-purple-600 rounded-xl w-fit mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Check Coverage</h3>
                      <p className="text-xs text-slate-600">See what's covered</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-emerald-50 to-emerald-100/50"
                onClick={() => window.location.href = createPageUrl('Inbox')}
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <div className="p-4 bg-emerald-600 rounded-xl w-fit mx-auto">
                      <MessageCircle className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Contact SilverBack</h3>
                      <p className="text-xs text-slate-600">Go to Inbox</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-rose-50 to-rose-100/50">
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <div className="p-4 bg-rose-600 rounded-xl w-fit mx-auto">
                      <Plus className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Add Home Services</h3>
                      <p className="text-xs text-slate-600">Coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <a
                href="https://workdrive.zohoexternal.com/external/9aebbd4d42bb52ecbe0f404bb482dd2532d647030075bb3872824f52ced98b51"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline"
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-cyan-50 to-cyan-100/50">
                  <CardContent className="p-6">
                    <div className="text-center space-y-3">
                      <div className="p-4 bg-cyan-600 rounded-xl w-fit mx-auto">
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">View Contract</h3>
                        <p className="text-xs text-slate-600">Read your contract</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            </div>

            {/* Properties Section */}
            <Card className="border-0 shadow-lg" id="properties">
              <CardHeader 
                className="bg-sky-600 text-zinc-50 p-6 flex flex-col space-y-1.5 border-b border-slate-100 cursor-pointer hover:bg-sky-700 transition-colors"
                onClick={() => setPropertiesExpanded(!propertiesExpanded)}
              >
                <div className="flex items-center gap-2">
                  {propertiesExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <MapPin className="h-5 w-5" />
                  <CardTitle className="text-xl">My Properties</CardTitle>
                </div>
                <p className="text-zinc-50 mt-1 text-sm">View your properties and their warranty coverage</p>
              </CardHeader>
              {propertiesExpanded && <CardContent className="p-6 space-y-6">
                {propertyGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                      <MapPin className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-2">No Properties Found</h3>
                    <p className="text-slate-500">Contact us to get started with your home warranty coverage.</p>
                    </div>
                    ) : (
                    propertyGroups.map((propertyGroup) => {
            const daysUntilExpiry = checkExpiration(propertyGroup.currentPolicy);

            return (
              <PropertyPolicyGroup
                key={propertyGroup.address}
                address={propertyGroup.address}
                policies={propertyGroup.policies}
                currentPolicy={propertyGroup.currentPolicy}
                onSelectPolicy={setSelectedPolicyId}
                selectedPolicyId={selectedPolicyId}
                daysUntilExpiry={daysUntilExpiry}
                claims={claims}
                claimFilter={claimFilter}
                onClaimFilterChange={setClaimFilter}
                customerName={user?.full_name}
                customerEmail={user?.email}
              />);


          })
                )}
              </CardContent>}
            </Card>

            {/* All Policies Section */}
            <Card className="border-0 shadow-lg" id="all-policies">
              <CardHeader 
                className="bg-sky-600 text-zinc-50 p-6 flex flex-col space-y-1.5 border-b border-slate-100 cursor-pointer hover:bg-sky-700 transition-colors"
                onClick={() => setAllPoliciesExpanded(!allPoliciesExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {allPoliciesExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    <Shield className="h-5 w-5" />
                    <CardTitle className="text-xl">My Policies</CardTitle>
                  </div>
                  <Select 
                    value={policyStatusFilter} 
                    onValueChange={setPolicyStatusFilter}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectTrigger className="w-[200px]" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Policies ({policies.length})</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Active Pending Payment">Active Pending Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-zinc-50 mt-1 text-sm">View all policies across all properties</p>
              </CardHeader>
              {allPoliciesExpanded && <CardContent className="p-6">
                {(() => {
                  const filteredByStatus = policyStatusFilter === 'all' 
                    ? policies 
                    : policies.filter(p => normalizeStatus(p.policy_status) === policyStatusFilter);

                  return filteredByStatus.length > 0 ? (
                  <div className="space-y-4">
                    {filteredByStatus.map((policy) => {
                      const policyDaysUntilExpiry = checkExpiration(policy);
                      const showPolicyActions = isWithinFirst30Days(policy);

                      return (
                      <Card key={policy.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1 space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-slate-900 mb-1">
                                    Policy #{policy.policy_number}
                                  </h4>
                                  <p className="text-sm text-slate-500"><strong>Plan:</strong> {policy.policy_name}</p>
                                  {policy.add_ons && policy.add_ons.length > 0 && (
                                    <p className="text-sm text-slate-500">
                                      <strong>Add Ons:</strong> {policy.add_ons.join(', ')}
                                    </p>
                                  )}
                                  </div>
                                  <Badge className={statusColors[normalizeStatus(policy.policy_status)] || statusColors.Pending}>
                                  {normalizeStatus(policy.policy_status)}
                                  </Badge>
                                  </div>

                                  <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                                {policy.policy_id && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Policy ID</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.policy_id}</p>
                                  </div>
                                )}
                                {policy.customer_name && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Customer Name</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.customer_name}</p>
                                  </div>
                                )}
                                {policy.customer_email && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Email</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.customer_email}</p>
                                  </div>
                                )}
                                {policy.customer_phone && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Phone</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.customer_phone}</p>
                                  </div>
                                )}
                                {policy.property_address && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Property Address</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.property_address}</p>
                                  </div>
                                )}
                                {policy.effective_date && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Effective Date</p>
                                    <p className="text-sm font-medium text-slate-900">{formatDate(policy.effective_date)}</p>
                                  </div>
                                )}
                                {policy.expiration_date && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Expiration Date</p>
                                    <p className="text-sm font-medium text-slate-900">{formatDate(policy.expiration_date)}</p>
                                  </div>
                                )}
                                {policy.zoho_id && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Zoho ID</p>
                                    <p className="text-sm font-medium text-slate-900">{policy.zoho_id}</p>
                                  </div>
                                )}
                              </div>

                              {policy.details_of_coverage && (
                                <div className="pt-3 border-t border-slate-100">
                                  <p className="text-xs text-slate-500 mb-1">Coverage Details</p>
                                  <p className="text-sm text-slate-600 leading-relaxed">
                                    {policy.details_of_coverage}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Policy Actions */}
                          <PolicyActionButtons policy={policy} />

                          {/* Expiration Warning */}
                          {policyDaysUntilExpiry && (
                            <div className={`border-2 rounded-lg p-4 ${policy.policy_number?.includes('-') ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/50' : 'border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/50'}`}>
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${policy.policy_number?.includes('-') ? 'bg-emerald-200' : 'bg-amber-200'}`}>
                                    <Calendar className={`h-5 w-5 ${policy.policy_number?.includes('-') ? 'text-emerald-700' : 'text-amber-700'}`} />
                                  </div>
                                  <div>
                                    <h4 className={`font-semibold mb-1 ${policy.policy_number?.includes('-') ? 'text-emerald-900' : 'text-amber-900'}`}>
                                      {policy.policy_number?.includes('-') ? 'Policy Renewing Soon!' : 'Policy Expiring Soon, Renew Today!'}
                                    </h4>
                                    <p className={`text-sm ${policy.policy_number?.includes('-') ? 'text-emerald-700' : 'text-amber-700'}`}>
                                      Your policy expires in <strong>{policyDaysUntilExpiry} days</strong>. {policy.policy_number?.includes('-') ? 'Your policy is on auto-renewal, reach out to our cancellation team at (801)686-8927 for help with any cancellation or auto-renewal questions.' : 'Reach out to our office at (801)686-8927 for help with any renewal questions.'}
                                    </p>
                                  </div>
                                </div>
                                {policy.policy_number?.includes('-') ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-4 py-2 whitespace-nowrap">
                                          <p className="text-sm font-medium text-emerald-900">
                                            Auto-renewal on {formatDate(policy.expiration_date)} at 11:59pm
                                          </p>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>For questions about auto-renewal please reach out to our office at (801)686-8927</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <Button className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Renew Policy
                                  </Button>
                                )}
                              </div>
                            </div>
                            )}
                          </CardContent>
                        </Card>
                    );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                      <Shield className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-2">No Policies Found</h3>
                    <p className="text-slate-500">Try adjusting your filter.</p>
                    </div>
                    );
                    })()}
                    </CardContent>}
                    </Card>

            {/* All Claims Section */}
            <Card className="border-0 shadow-lg" id="claims">
              <CardHeader 
                className="bg-sky-600 text-zinc-50 p-6 flex flex-col space-y-1.5 border-b border-slate-100 cursor-pointer hover:bg-sky-700 transition-colors"
                onClick={() => setAllClaimsExpanded(!allClaimsExpanded)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {allClaimsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        My Claims
                      </CardTitle>
                      <p className="text-zinc-50 mt-1 text-sm">View all claims across all properties and policies

                  </p>
                    </div>
                  </div>
                  <Select 
                    value={claimFilter} 
                    onValueChange={setClaimFilter}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectTrigger className="w-[200px]" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Claims ({claims.length})</SelectItem>
                      <SelectItem value="active">Active & In Progress</SelectItem>
                      <SelectItem value="approved">Approved & Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Denied">Denied</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                  </CardHeader>
                  {allClaimsExpanded && <CardContent className="p-6">
                    {(() => {
                    const filteredAllClaims = (() => {
                      let claimsToFilter = claims;
                  if (claimFilter === 'all') return claimsToFilter;
                  if (claimFilter === 'active') return claimsToFilter.filter((c) => c.claim_status === 'Active' || c.claim_status === 'In Progress');
                  if (claimFilter === 'approved') return claimsToFilter.filter((c) => c.claim_status === 'Approved' || c.claim_status === 'Completed');
                  return claimsToFilter.filter((c) => c.claim_status === claimFilter);
                })();

                return filteredAllClaims.length > 0 ?
                <div className="space-y-4">
                      {filteredAllClaims.map((claim) => {
                        const claimPolicy = policies.find(p => p.policy_number === claim.policy_id);
                        const cancellableStatuses = ['Active', 'Pending SCF', 'Pending H/O', 'Pending Autho', 'Pending SBHW Callback', 'CIL', 'In Progress'];
                        const canCancelClaim = cancellableStatuses.includes(claim.claim_status);
                        return (
                      <Card key={claim.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">
                                      Claim #{claim.claim_name}
                                    </h4>
                                  </div>
                                  <Badge className={statusColors[normalizeStatus(claim.claim_status)] || statusColors.Pending}>
                                    {normalizeStatus(claim.claim_status)}
                                  </Badge>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                                  {claim.policy_id && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Policy</p>
                                      <p className="text-sm font-medium text-slate-900">#{claim.policy_id}</p>
                                    </div>
                                  )}
                                  {claim.claim_date && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Claim Date</p>
                                      <p className="text-sm font-medium text-slate-900">{formatDate(claim.claim_date)}</p>
                                    </div>
                                  )}
                                  {claim.claim_type && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Claim Type</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.claim_type}</p>
                                    </div>
                                  )}
                                  {claim.customer_email && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Customer Email</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.customer_email}</p>
                                    </div>
                                  )}
                                  {claim.customer_phone && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Customer Phone</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.customer_phone}</p>
                                    </div>
                                  )}
                                  {claim.property_address && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Property Address</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.property_address}</p>
                                    </div>
                                  )}
                                  {claim.contractor && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Contractor</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.contractor}</p>
                                    </div>
                                  )}
                                  {claim.contractor_email && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Contractor Email</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.contractor_email}</p>
                                    </div>
                                  )}
                                  {claim.zoho_id && (
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Zoho ID</p>
                                      <p className="text-sm font-medium text-slate-900">{claim.zoho_id}</p>
                                    </div>
                                  )}
                                </div>

                                {claim.customer_facing_description && (
                                  <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs text-slate-500 mb-1">Description</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                      {claim.customer_facing_description}
                                    </p>
                                  </div>
                                )}

                                <div className="pt-3 border-t border-slate-100">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!canCancelClaim}
                                            onClick={canCancelClaim ? () => {
                                              setSelectedClaim({ claim, policy: claimPolicy });
                                              setClaimCancellationDialogOpen(true);
                                            } : undefined}
                                          >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Request Claim Cancellation
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      {!canCancelClaim && (
                                        <TooltipContent>
                                          <p>This claim has been closed, please contact us at (801)686-8927 for assistance</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div> :

                <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-700 mb-2">
                        {claimFilter === 'all' ? 'No Claims Yet' : `No ${claimFilter === 'active' ? 'Active or In Progress' : claimFilter === 'approved' ? 'Approved or Completed' : claimFilter} Claims`}
                      </h3>
                      <p className="text-slate-500">
                        {claimFilter === 'all' ? "You haven't submitted any claims yet." : "No claims match the selected filter."}
                      </p>
                    </div>;

              })()}
              </CardContent>}
              </Card>

            {/* Renewal History Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader 
                className="bg-sky-600 text-zinc-50 p-6 flex flex-col space-y-1.5 border-b border-slate-100 cursor-pointer hover:bg-sky-700 transition-colors"
                onClick={() => setRenewalHistoryExpanded(!renewalHistoryExpanded)}
              >
                <div className="flex items-center gap-2">
                  {renewalHistoryExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <Calendar className="h-5 w-5" />
                  <CardTitle className="text-xl">Renewal History</CardTitle>
                </div>
                <p className="text-zinc-50 mt-1 text-sm">View past policy renewals and their details</p>
              </CardHeader>
              {renewalHistoryExpanded && <CardContent className="p-6">
                {propertyGroups.flatMap(pg => pg.policies.slice(1)).length > 0 ? (
                  <div className="space-y-4">
                    {propertyGroups.map((propertyGroup) => 
                      propertyGroup.policies.slice(1).map((policy) => (
                        <Card 
                          key={policy.id} 
                          className="border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedRenewalPolicy(selectedRenewalPolicy?.id === policy.id ? null : policy)}
                        >
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">
                                      Policy #{policy.policy_number}
                                    </h4>
                                    <p className="text-sm text-slate-500">{policy.policy_name}</p>
                                  </div>
                                  <Badge className={statusColors[normalizeStatus(policy.policy_status)] || statusColors.Expired}>
                                    {normalizeStatus(policy.policy_status)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <MapPin className="h-4 w-4" />
                                  <span>{propertyGroup.address}</span>
                                </div>
                              </div>
                              <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${selectedRenewalPolicy?.id === policy.id ? 'rotate-90' : ''}`} />
                            </div>

                            {selectedRenewalPolicy?.id === policy.id && (
                              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {policy.effective_date && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">Effective:</span>
                                      <span className="font-medium text-slate-900">{formatDate(policy.effective_date)}</span>
                                    </div>
                                  )}
                                  {policy.expiration_date && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">Expires:</span>
                                      <span className="font-medium text-slate-900">{formatDate(policy.expiration_date)}</span>
                                    </div>
                                  )}
                                </div>

                                {policy.details_of_coverage && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Coverage Details:</p>
                                    <p className="text-sm text-slate-600">{policy.details_of_coverage}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-2">No Renewal History</h3>
                    <p className="text-slate-500">Past policy renewals will appear here.</p>
                  </div>
                )}
                </CardContent>}
                </Card>
                </div>
                }

        {/* Contact Dialog */}
        <ContactDialog open={contactDialogOpen} onOpenChange={setContactDialogOpen} />

        {/* Coverage Checker Dialog */}
        <CoverageCheckerDialog 
          open={coverageDialogOpen} 
          onOpenChange={setCoverageDialogOpen}
          policies={policies}
          claims={claims}
        />

        {/* Submit Claim Dialog */}
        <SubmitClaimDialog
          open={submitClaimDialogOpen}
          onOpenChange={setSubmitClaimDialogOpen}
          policies={policies}
        />

        {/* Claim Cancellation Dialog */}
        <ClaimCancellationDialog
          open={claimCancellationDialogOpen}
          onOpenChange={setClaimCancellationDialogOpen}
          claim={selectedClaim?.claim}
          policy={selectedClaim?.policy}
          customerName={user?.full_name}
          customerEmail={user?.email}
        />
        </div>
        </div>);

        }