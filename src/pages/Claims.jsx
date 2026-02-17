import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Calendar, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import ClaimCancellationDialog from '../components/dashboard/ClaimCancellationDialog';

const statusColors = {
  Active: "bg-blue-100 text-blue-700",
  Approved: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Completed: "bg-slate-100 text-slate-600",
  Denied: "bg-red-100 text-red-700",
  Pending: "bg-purple-100 text-purple-700"
};

export default function Claims() {
  const [user, setUser] = React.useState(null);
  const [claimCancellationDialogOpen, setClaimCancellationDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const viewAsEmail = urlParams.get('viewAsEmail');
  const customerEmail = (viewAsEmail && user?.role === 'admin') ? viewAsEmail : user?.email;

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['my-claims', customerEmail, viewAsEmail, user?.role],
    queryFn: async () => {
      if (viewAsEmail && user?.role === 'admin') {
        return base44.asServiceRole.entities.Claim.filter({ customer_email: viewAsEmail });
      }
      return base44.entities.Claim.filter({ customer_email: user.email });
    },
    enabled: !!user && !!customerEmail,
  });

  const { data: policies = [] } = useQuery({
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
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Claims</h1>
            <p className="text-sm text-slate-500">View all your submitted claims</p>
          </div>
        </div>

        {claims.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No claims found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="border-0 shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Claim #{claim.claim_name}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">{claim.claim_type || '—'}</p>
                    </div>
                    <Badge className={statusColors[claim.claim_status] || statusColors.Pending}>
                      {claim.claim_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {claim.customer_facing_description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Description</p>
                      <p className="text-sm text-slate-700">{claim.customer_facing_description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {claim.claim_date && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Claim Date
                        </p>
                        <p className="text-sm font-medium text-slate-900">{formatDate(claim.claim_date)}</p>
                      </div>
                    )}
                    {claim.policy_id && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Policy #</p>
                        <p className="text-sm font-medium text-slate-900">{claim.policy_id}</p>
                      </div>
                    )}
                  </div>

                  {claim.contractor && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Assigned Contractor</p>
                      <p className="text-sm text-slate-700">{claim.contractor}</p>
                      {claim.contractor_email && (
                        <p className="text-xs text-slate-500 mt-1">{claim.contractor_email}</p>
                      )}
                    </div>
                  )}

                  {claim.property_address && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Property Address</p>
                      <p className="text-sm text-slate-700">{claim.property_address}</p>
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
                              disabled={!['Active', 'Pending SCF', 'Pending H/O', 'Pending Autho', 'Pending SBHW Callback', 'CIL', 'In Progress'].includes(claim.claim_status)}
                              onClick={() => {
                                const claimPolicy = policies.find(p => p.policy_number === claim.policy_id);
                                setSelectedClaim({ claim, policy: claimPolicy });
                                setClaimCancellationDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Request Claim Cancellation
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!['Active', 'Pending SCF', 'Pending H/O', 'Pending Autho', 'Pending SBHW Callback', 'CIL', 'In Progress'].includes(claim.claim_status) && (
                          <TooltipContent>
                            <p>This claim has been closed, please contact us at (801)686-8927 for assistance</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ClaimCancellationDialog
          open={claimCancellationDialogOpen}
          onOpenChange={setClaimCancellationDialogOpen}
          claim={selectedClaim?.claim}
          policy={selectedClaim?.policy}
          customerName={user?.full_name}
          customerEmail={user?.email}
        />
      </div>
    </div>
  );
}