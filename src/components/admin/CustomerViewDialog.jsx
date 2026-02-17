import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Loader2, Shield, FileText, MapPin } from 'lucide-react';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Active (Not Renewing)": "bg-amber-100 text-amber-700 border-amber-200",
  Expired: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-slate-400 text-slate-800 border-slate-500",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  "Active Pending Payment": "bg-purple-100 text-purple-700 border-purple-200"
};

const normalizeStatus = (status) => {
  if (!status) return 'Pending';
  if (status === 'Do Not Renew' || status === 'Not Renewing') {
    return 'Active (Not Renewing)';
  }
  return status;
};

export default function CustomerViewDialog({ open, onOpenChange, customerEmail, customerName }) {
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['customer-policies', customerEmail],
    queryFn: async () => {
      if (!customerEmail) return [];
      try {
        const result = await base44.asServiceRole.entities.Policy.filter({ customer_email: customerEmail });
        return result;
      } catch (error) {
        console.error('Error fetching policies:', error);
        return [];
      }
    },
    enabled: open && !!customerEmail,
    staleTime: 30000
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['customer-claims', customerEmail],
    queryFn: async () => {
      if (!customerEmail) return [];
      try {
        const result = await base44.asServiceRole.entities.Claim.filter({ customer_email: customerEmail }, '-claim_date');
        return result;
      } catch (error) {
        console.error('Error fetching claims:', error);
        return [];
      }
    },
    enabled: open && !!customerEmail,
    staleTime: 30000
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  const isLoading = policiesLoading || claimsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <User className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <DialogTitle>Viewing as Customer</DialogTitle>
                <p className="text-sm text-slate-500">{customerName || customerEmail}</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="policies">Policies ({policies.length})</TabsTrigger>
              <TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 mt-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="border border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <MapPin className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Properties</p>
                        <p className="text-lg font-bold text-slate-900">
                          {[...new Set(policies.map(p => p.property_address))].length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Shield className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Active Policies</p>
                        <p className="text-lg font-bold text-slate-900">
                          {policies.filter(p => p.policy_status === 'Active').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <FileText className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Claims</p>
                        <p className="text-lg font-bold text-slate-900">{claims.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Policies */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Recent Policies
                </h3>
                <div className="space-y-2">
                  {policies.slice(0, 3).map((policy) => (
                    <Card key={policy.id} className="border border-slate-200">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-slate-900">Policy #{policy.policy_number}</p>
                            <p className="text-xs text-slate-500">{policy.policy_name}</p>
                            {policy.property_address && (
                              <p className="text-xs text-slate-500 mt-1">{policy.property_address}</p>
                            )}
                          </div>
                          <Badge className={statusColors[normalizeStatus(policy.policy_status)] || statusColors.Pending}>
                            {normalizeStatus(policy.policy_status)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Recent Claims */}
              {claims.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Recent Claims
                  </h3>
                  <div className="space-y-2">
                    {claims.slice(0, 3).map((claim) => (
                      <Card key={claim.id} className="border border-slate-200">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-slate-900">Claim #{claim.claim_name}</p>
                              {claim.claim_type && (
                                <p className="text-xs text-slate-500">{claim.claim_type}</p>
                              )}
                              {claim.property_address && (
                                <p className="text-xs text-slate-500 mt-1">{claim.property_address}</p>
                              )}
                            </div>
                            <Badge className={statusColors[normalizeStatus(claim.claim_status)] || statusColors.Pending}>
                              {normalizeStatus(claim.claim_status)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="policies" className="space-y-4 mt-4">
              {policies.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No policies found</p>
                </div>
              ) : (
                policies.map((policy) => (
                  <Card key={policy.id} className="border border-slate-200">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-1">
                            Policy #{policy.policy_number}
                          </h4>
                          <p className="text-sm text-slate-500">
                            <strong>Plan:</strong> {policy.policy_name}
                          </p>
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

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
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
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="claims" className="space-y-4 mt-4">
              {claims.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No claims found</p>
                </div>
              ) : (
                claims.map((claim) => (
                  <Card key={claim.id} className="border border-slate-200">
                    <CardContent className="p-5 space-y-4">
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

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
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
                            <p className="text-xs text-slate-500 mb-1">Type</p>
                            <p className="text-sm font-medium text-slate-900">{claim.claim_type}</p>
                          </div>
                        )}
                        {claim.property_address && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Property</p>
                            <p className="text-sm font-medium text-slate-900">{claim.property_address}</p>
                          </div>
                        )}
                        {claim.contractor && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Contractor</p>
                            <p className="text-sm font-medium text-slate-900">{claim.contractor}</p>
                          </div>
                        )}
                      </div>

                      {claim.customer_facing_description && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Description</p>
                          <p className="text-sm text-slate-600">{claim.customer_facing_description}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}