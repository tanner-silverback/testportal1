import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Users, Mail, Shield, FileText, ChevronDown, ChevronRight, Search, Phone, KeyRound, Ban, CheckCircle2, Clock, AlertCircle, Eye, UserX
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CustomerViewDialog from '../components/admin/CustomerViewDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';

export default function AdminCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [customerViewDialogOpen, setCustomerViewDialogOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);

  // Handle URL parameter for filtering and auto-expand
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email) {
      setSearchTerm(email);
      setExpandedCustomer(email);
    }
  }, []);

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => base44.entities.Policy.list(),
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list(),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Group by customer email
  const customerMap = {};
  
  policies.forEach(policy => {
    if (policy.customer_email) {
      if (!customerMap[policy.customer_email]) {
        customerMap[policy.customer_email] = {
          email: policy.customer_email,
          name: policy.customer_name || 'Unknown',
          phone: policy.customer_phone || '',
          policies: [],
          claims: [],
          account: null
        };
      }
      // Update phone if we don't have one yet
      if (!customerMap[policy.customer_email].phone && policy.customer_phone) {
        customerMap[policy.customer_email].phone = policy.customer_phone;
      }
      customerMap[policy.customer_email].policies.push(policy);
    }
  });

  claims.forEach(claim => {
    if (claim.customer_email) {
      if (!customerMap[claim.customer_email]) {
        customerMap[claim.customer_email] = {
          email: claim.customer_email,
          name: 'Unknown',
          phone: claim.customer_phone || '',
          policies: [],
          claims: [],
          account: null
        };
      }
      // Update phone if we don't have one yet
      if (!customerMap[claim.customer_email].phone && claim.customer_phone) {
        customerMap[claim.customer_email].phone = claim.customer_phone;
      }
      customerMap[claim.customer_email].claims.push(claim);
    }
  });

  // Attach user records
  users.forEach(user => {
    if (customerMap[user.email]) {
      customerMap[user.email].user = user;
    }
  });

  const customers = Object.values(customerMap).filter(customer => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return customer.email.toLowerCase().includes(term) || 
           customer.name.toLowerCase().includes(term);
  });

  const statusColors = {
    Active: 'bg-green-100 text-green-800',
    Expired: 'bg-red-100 text-red-800',
    Cancelled: 'bg-gray-100 text-gray-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Approved: 'bg-green-100 text-green-800',
    Denied: 'bg-red-100 text-red-800'
  };

  const handleResetPassword = (customer) => {
    setResetPasswordDialog(customer);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveNewPassword = async () => {
    if (!confirm(`Send password reset link to ${resetPasswordDialog.email}?`)) {
      return;
    }

    try {
      await base44.functions.invoke('updateCustomerPassword', { 
        email: resetPasswordDialog.email
      });

      alert('Password reset link sent successfully.');
      setResetPasswordDialog(null);
      window.location.reload();
    } catch (error) {
      alert('Failed to send reset link: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateAccount = async (customer) => {
    if (!confirm(`Create account for ${customer.email}?`)) return;
    
    try {
      await base44.users.inviteUser(customer.email, 'user');
      alert('Invitation sent! Customer will receive an email to set up their account.');
      window.location.reload();
    } catch (error) {
      alert('Failed to invite user: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleBlock = async (user) => {
    const action = user.is_blocked ? 'unblock' : 'block';
    if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
    
    try {
      await base44.functions.invoke('toggleUserBlock', { 
        email: user.email,
        blocked: !user.is_blocked 
      });
      window.location.reload();
    } catch (error) {
      alert(`Failed to ${action} user: ` + error.message);
    }
  };

  const handleRemoveUser = async (customer) => {
    if (!confirm(`Are you sure you want to remove ${customer.email} from authentication? They will not be able to log in anymore, but their data will be preserved.`)) return;
    
    try {
      await base44.functions.invoke('removeUserAccount', { 
        email: customer.email
      });
      alert('User removed from authentication successfully');
      window.location.reload();
    } catch (error) {
      alert('Failed to remove user: ' + (error.response?.data?.error || error.message));
    }
  };



  const getUserStatus = (customer) => {
    if (!customer.user) {
      return { 
        label: 'No Account', 
        color: 'bg-slate-100 text-slate-600',
        icon: Clock
      };
    }
    if (customer.user.is_blocked) {
      return { 
        label: 'Blocked', 
        color: 'bg-red-100 text-red-700',
        icon: Ban
      };
    }
    return { 
      label: 'Active', 
      color: 'bg-green-100 text-green-700',
      icon: CheckCircle2
    };
  };

  if (policiesLoading || claimsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-500">View all customers with their policies and claims</p>
          </div>
        </div>

        {/* Search */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by customer name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        <div className="space-y-3">
          {customers.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No customers found</p>
              </CardContent>
            </Card>
          ) : (
            customers.map((customer) => {
              const status = getUserStatus(customer);
              const StatusIcon = status.icon;
              
              return (
              <Card key={customer.email} className="border-0 shadow-sm">
                <CardHeader 
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedCustomer(expandedCustomer === customer.email ? null : customer.email)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 font-medium">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{customer.name}</CardTitle>
                          <Badge className={`${status.color} flex items-center gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-slate-500 mt-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-2">
                              <span>📞</span>
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Shield className="h-4 w-4" />
                          <span className="font-medium">{customer.policies.length}</span>
                          <span className="text-slate-500">policies</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">{customer.claims.length}</span>
                          <span className="text-slate-500">claims</span>
                        </div>
                      </div>
                      {expandedCustomer === customer.email ? (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedCustomer === customer.email && (
                  <CardContent className="border-t border-slate-100 space-y-6">
                    {/* Customer Details */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Customer Information
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCustomer({ email: customer.email, name: customer.name });
                              setCustomerViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View as Customer
                          </Button>
                          {customer.user ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetPassword(customer);
                                }}
                              >
                                <KeyRound className="h-3 w-3 mr-1" />
                                Reset Password
                              </Button>
                              <Button
                                size="sm"
                                variant={customer.user.is_blocked ? "default" : "destructive"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleBlock(customer.user);
                                }}
                              >
                                {customer.user.is_blocked ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Unblock
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3 w-3 mr-1" />
                                    Block
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveUser(customer);
                                }}
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Remove User
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateAccount(customer);
                              }}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              Invite User
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Name:</span>
                          <span className="font-medium text-slate-900">{customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-500 w-16">Email:</span>
                          <span className="text-slate-900">{customer.email}</span>
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-slate-500" />
                            <span className="text-slate-500 w-16">Phone:</span>
                            <span className="text-slate-900">{customer.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-500 w-16">Status:</span>
                          <Badge className={`${status.color} text-xs`}>
                            {status.label}
                          </Badge>
                        </div>
                        {customer.user && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 w-20">Account:</span>
                            <span className="text-slate-900">Created {format(new Date(customer.user.created_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Policies Section */}
                    {customer.policies.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Policies ({customer.policies.length})
                        </h3>
                        <div className="space-y-2">
                          {customer.policies.map((policy) => (
                            <div key={policy.id} className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <Link 
                                    to={createPageUrl(`AdminPolicies?policy=${policy.policy_number}`)}
                                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                                  >
                                    {policy.policy_number}
                                  </Link>
                                  <p className="text-sm text-slate-600"><strong>Plan:</strong> {policy.policy_name}</p>
                                </div>
                                <Badge className={statusColors[policy.policy_status]}>
                                  {policy.policy_status}
                                </Badge>
                              </div>
                              {policy.add_ons && policy.add_ons.length > 0 && (
                                <div className="text-sm text-slate-600 mb-2">
                                  <strong>Add Ons:</strong> {policy.add_ons.join(', ')}
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-slate-500">
                                {policy.effective_date && (
                                  <span>Effective: {format(new Date(policy.effective_date), 'MMM d, yyyy')}</span>
                                )}
                                {policy.expiration_date && (
                                  <span>Expires: {format(new Date(policy.expiration_date), 'MMM d, yyyy')}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Claims Section */}
                    {customer.claims.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Claims ({customer.claims.length})
                        </h3>
                        <div className="space-y-2">
                          {customer.claims.map((claim) => (
                            <div key={claim.id} className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <Link 
                                    to={createPageUrl(`AdminClaims?claim=${claim.claim_name}`)}
                                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                                  >
                                    {claim.claim_name}
                                  </Link>
                                  {claim.claim_type && (
                                    <p className="text-sm text-slate-600">{claim.claim_type}</p>
                                  )}
                                </div>
                                <Badge className={statusColors[claim.claim_status]}>
                                  {claim.claim_status}
                                </Badge>
                              </div>
                              {claim.customer_facing_description && (
                                <p className="text-sm text-slate-600 mb-2">{claim.customer_facing_description}</p>
                              )}
                              <div className="flex gap-4 text-xs text-slate-500">
                                {claim.claim_date && (
                                  <span>Filed: {format(new Date(claim.claim_date), 'MMM d, yyyy')}</span>
                                )}
                                {claim.contractor && (
                                  <span>Contractor: {claim.contractor}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>);
            })
          )}
        </div>

        {/* Password Reset Dialog */}
        <Dialog open={!!resetPasswordDialog} onOpenChange={() => setResetPasswordDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-600">
                A password reset email will be sent to <strong>{resetPasswordDialog?.email}</strong> with a link to set a new password.
              </p>
              <div className="space-y-2">
                <Label>Customer Email</Label>
                <Input value={resetPasswordDialog?.email || ''} disabled className="bg-slate-50" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNewPassword} className="bg-slate-900 hover:bg-slate-800">
                Send Reset Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer View Dialog */}
        <CustomerViewDialog
          open={customerViewDialogOpen}
          onOpenChange={setCustomerViewDialogOpen}
          customerEmail={viewingCustomer?.email}
          customerName={viewingCustomer?.name}
        />
      </div>
    </div>
  );
}