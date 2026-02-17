import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Shield, Calendar, CreditCard, Clock, FileText, Plus, X, Ban } from 'lucide-react';
import { format } from 'date-fns';
import ClaimCancellationDialog from './ClaimCancellationDialog';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Active (Not Renewing)": "bg-amber-100 text-amber-700 border-amber-200",
  "Active Pending Payment": "bg-amber-100 text-amber-700 border-amber-200",
  Expired: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-slate-400 text-slate-800 border-slate-500",
  Pending: "bg-amber-100 text-amber-700 border-amber-200"
};

const normalizeStatus = (status) => {
  if (!status) return 'Pending';
  if (status === 'Do Not Renew' || status === 'Not Renewing') {
    return 'Active (Not Renewing)';
  }
  return status;
};

export default function PropertyPolicyGroup({
  address,
  policies,
  currentPolicy,
  onSelectPolicy,
  selectedPolicyId,
  daysUntilExpiry,
  claims,
  claimFilter,
  onClaimFilterChange,
  customerName,
  customerEmail
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewingPolicyId, setViewingPolicyId] = useState(currentPolicy.id);
  const [claimCancellationDialogOpen, setClaimCancellationDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Sort policies by renewal number (highest first)
  const sortedPolicies = [...policies].sort((a, b) => {
    const getNumber = (policyNum) => {
      const match = String(policyNum).match(/-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    };
    return getNumber(b.policy_number) - getNumber(a.policy_number);
  });

  const isCurrentPolicy = (policy) => policy.id === currentPolicy.id;

  // Get claims for the policy being viewed
  const viewingPolicy = policies.find((p) => p.id === viewingPolicyId) || currentPolicy;
  const viewingPolicyClaims = claims.filter((c) =>
  c.policy_id && String(c.policy_id).trim() === String(viewingPolicy.policy_number).trim()
  );

  // Apply filter
  const filteredClaims = (() => {
    if (claimFilter === 'all') return viewingPolicyClaims;
    if (claimFilter === 'active') return viewingPolicyClaims.filter((c) => c.claim_status === 'Active' || c.claim_status === 'In Progress');
    if (claimFilter === 'approved') return viewingPolicyClaims.filter((c) => c.claim_status === 'Approved' || c.claim_status === 'Completed');
    return viewingPolicyClaims.filter((c) => c.claim_status === claimFilter);
  })();

  const statusColors = {
    Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Active Pending Payment": "bg-amber-100 text-amber-700 border-amber-200",
    Expired: "bg-red-100 text-red-700 border-red-200",
    Cancelled: "bg-slate-400 text-slate-800 border-slate-500",
    Pending: "bg-amber-100 text-amber-700 border-amber-200",
    "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
    Completed: "bg-green-100 text-green-700 border-green-200",
    Denied: "bg-red-100 text-red-700 border-red-200",
    Approved: "bg-emerald-100 text-emerald-700 border-emerald-200"
  };

  const isWithinFirst30Days = (policy) => {
    if (!policy.effective_date) return false;
    const effectiveDate = new Date(policy.effective_date);
    const today = new Date();
    const daysSinceEffective = Math.ceil((today - effectiveDate) / (1000 * 60 * 60 * 24));
    return daysSinceEffective <= 30 && daysSinceEffective >= 0;
  };

  const showPolicyActions = isCurrentPolicy(viewingPolicy) && isWithinFirst30Days(viewingPolicy);

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-slate-800 text-white p-6 flex flex-col space-y-1.5 border-b border-slate-100 cursor-pointer hover:bg-slate-700 transition-all"

      onClick={() => setExpanded(!expanded)}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <div>
              <CardTitle className="text-lg">{address || 'No Address Listed'}</CardTitle>
              <p className="text-sm text-slate-300 mt-1">
                {policies.length} {policies.length === 1 ? 'Policy' : 'Policies'} • Current: #{currentPolicy.policy_number}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={statusColors[normalizeStatus(currentPolicy.policy_status)] || statusColors.Pending}>
              {normalizeStatus(currentPolicy.policy_status)}
            </Badge>
            {daysUntilExpiry && (
              <p className="text-xs text-slate-300">
                Policy Expires in {daysUntilExpiry} Days
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded &&
      <CardContent className="p-6 space-y-6">
          {/* Policies Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Policies
            </h4>
            <div className="space-y-2">
              {sortedPolicies.map((policy) => {
                const isCurrent = isCurrentPolicy(policy);
                const isViewing = viewingPolicyId === policy.id;

                return (
                  <button
                    key={policy.id}
                    onClick={() => setViewingPolicyId(policy.id)}
                    className={`w-full text-left border-2 rounded-lg p-4 transition-all ${
                      isViewing && isCurrent ?
                      'bg-emerald-50 border-slate-900' :
                      isViewing && !isCurrent ?
                      'bg-slate-50 border-slate-900' :
                      isCurrent ?
                      'bg-white border-emerald-400 hover:border-emerald-500' :
                      'bg-slate-100 border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">Policy #{policy.policy_number}</p>
                      </div>
                      <Badge className={statusColors[normalizeStatus(policy.policy_status)] || statusColors.Pending}>
                        {normalizeStatus(policy.policy_status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2"><strong>Plan:</strong> {policy.policy_name || '—'}</p>
                    {policy.add_ons && policy.add_ons.length > 0 && (
                      <p className="text-sm text-slate-600 mb-2">
                        <strong>Add Ons:</strong> {policy.add_ons.join(', ')}
                      </p>
                    )}

                    {isViewing && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Effective Date</p>
                          <p className="font-medium text-slate-900">{formatDate(policy.effective_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Expiration Date</p>
                          <p className="font-medium text-slate-900">{formatDate(policy.expiration_date)}</p>
                        </div>
                      </div>

                      {(() => {
                        const isExpired = policy.policy_status === 'Expired' || policy.policy_status === 'Cancelled' || 
                          (policy.expiration_date && new Date(policy.expiration_date) < new Date());

                        const policyDaysUntilExpiry = (() => {
                          if (!policy.expiration_date) return null;
                          const expirationDate = new Date(policy.expiration_date);
                          const today = new Date();
                          const days = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
                          return days > 0 && days <= 60 ? days : null;
                        })();

                        const canRenew = !isExpired && policyDaysUntilExpiry;

                        return (
                          <>
                            {policy.policy_number?.includes('-') ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                                      <p className="text-sm font-medium text-blue-900">
                                        {policyDaysUntilExpiry && `Your policy expires in ${policyDaysUntilExpiry} days. `}
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
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="w-full block">
                                      <Button 
                                        className="bg-blue-600 hover:bg-blue-700 text-white w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!canRenew}
                                      >
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Renew Policy
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!canRenew && (
                                    <TooltipContent>
                                      <p>{isExpired ? 'Policy has expired' : 'Renewal available within 60 days of expiration'}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* A La Carte and Cancel buttons */}
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-3">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex-1">
                                      <Button 
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                        disabled={!isWithinFirst30Days(policy) || isExpired}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Purchase A La Carte Add Ons
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {(!isWithinFirst30Days(policy) || isExpired) && (
                                    <TooltipContent>
                                      <p>{isExpired ? 'Policy has expired' : 'A La Carte Items can only be added in the first 30 days'}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex-1">
                                      <Button 
                                        variant="destructive" 
                                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                        disabled={!isWithinFirst30Days(policy) || isExpired}
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel Policy
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {(!isWithinFirst30Days(policy) || isExpired) && (
                                    <TooltipContent>
                                      <p>{isExpired ? 'Policy has expired' : 'Policy can only be cancelled in the first 30 days'}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </>
                        );
                      })()}

                        {policy.details_of_coverage && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Coverage Details</p>
                            <div className="bg-white rounded-lg p-3 border border-slate-100">
                              <p className="text-sm text-slate-700 leading-relaxed">{policy.details_of_coverage}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Claims Section */}
          <div className="space-y-3 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Claims
              </h4>
              <select
                value={claimFilter}
                onChange={(e) => onClaimFilterChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900">

                <option value="all">All ({viewingPolicyClaims.length})</option>
                <option value="active">Active</option>
                <option value="approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Denied">Denied</option>
              </select>
            </div>
            
            {filteredClaims.length > 0 ?
          <div className="space-y-3">
                {filteredClaims.map((claim) => {
                  const claimPolicy = policies.find(p => p.policy_number === claim.policy_id);
                  const cancellableStatuses = ['Active', 'Pending SCF', 'Pending H/O', 'Pending Autho', 'Pending SBHW Callback', 'CIL'];
                  const canCancelClaim = cancellableStatuses.includes(claim.claim_status);
                  return (
                <div key={claim.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-semibold text-slate-900">Claim #{claim.claim_name}</h5>
                                <p className="text-xs text-slate-500 mt-0.5">{formatDate(claim.claim_date)}</p>
                              </div>
                              <Badge className={statusColors[normalizeStatus(claim.claim_status)] || statusColors.Pending}>
                                {normalizeStatus(claim.claim_status)}
                              </Badge>
                            </div>

                            {claim.claim_type &&
                      <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Type:</span>
                                <span className="font-medium text-slate-900">{claim.claim_type}</span>
                              </div>
                      }

                            {claim.policy_id &&
                      <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Policy:</span>
                                <span className="font-medium text-slate-900">#{claim.policy_id}</span>
                              </div>
                      }

                            {claim.property_address &&
                      <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Property:</span>
                                <span className="font-medium text-slate-900">{claim.property_address}</span>
                              </div>
                      }

                            {claim.contractor &&
                      <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Contractor:</span>
                                <span className="font-medium text-slate-900">{claim.contractor}</span>
                              </div>
                      }

                            {claim.contractor_email &&
                      <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Contractor Email:</span>
                                <span className="font-medium text-slate-900">{claim.contractor_email}</span>
                              </div>
                      }

                            {claim.customer_facing_description &&
                      <div className="pt-2 border-t border-slate-100">
                                <p className="text-sm text-slate-600 leading-relaxed">
                                  {claim.customer_facing_description}
                                </p>
                              </div>
                      }

                            <div className="pt-2 border-t border-slate-100">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!canCancelClaim}
                                        onClick={canCancelClaim ? () => {
                                          setSelectedClaim({ claim, policy: claimPolicy });
                                          setClaimCancellationDialogOpen(true);
                                        } : undefined}
                                      >
                                        <Ban className="h-3 w-3 mr-2" />
                                        Request Cancellation
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
                      </div>
                );
                })}
              </div> :

          <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  {claimFilter === 'all' ? 'No Claims Yet' : `No ${claimFilter === 'active' ? 'Active or In Progress' : claimFilter === 'approved' ? 'Approved or Completed' : claimFilter} Claims`}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {claimFilter === 'all' ?
              `No claims found for policy #${viewingPolicy.policy_number}.` :
              `No claims match the selected filter.`}
                </p>
              </div>
          }
          </div>

          <ClaimCancellationDialog
            open={claimCancellationDialogOpen}
            onOpenChange={setClaimCancellationDialogOpen}
            claim={selectedClaim?.claim}
            policy={selectedClaim?.policy}
            customerName={customerName}
            customerEmail={customerEmail}
          />

          </CardContent>
          }
          </Card>);

}