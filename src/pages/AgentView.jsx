import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Shield, FileText, Users, Building, Mail, Phone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expired: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-slate-400 text-slate-800 border-slate-500",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Approved: "bg-green-100 text-green-700 border-green-200",
  Denied: "bg-red-100 text-red-700 border-red-200"
};

export default function AgentView() {
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: reProData = [], isLoading: reProLoading } = useQuery({
    queryKey: ['repro-data', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.REPro.filter({ rep_email: user.email });
    },
    enabled: !!user?.email
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['agent-policies', reProData],
    queryFn: async () => {
      if (reProData.length === 0) return [];
      const reProId = reProData[0].zoho_id;
      if (!reProId) return [];
      
      // Get all policies where this RE Pro ID is in the re_pro_ids array
      const allPolicies = await base44.entities.Policy.list();
      return allPolicies.filter(p => 
        p.re_pro_ids && p.re_pro_ids.includes(reProId)
      );
    },
    enabled: reProData.length > 0
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['agent-claims', policies],
    queryFn: async () => {
      if (policies.length === 0) return [];
      
      // Get policy IDs from the filtered policies
      const policyIds = policies.map(p => p.policy_number);
      
      // Get all claims that match these policy IDs
      const allClaims = await base44.entities.Claim.list();
      return allClaims.filter(c => 
        c.policy_id && policyIds.includes(c.policy_id)
      );
    },
    enabled: !policiesLoading && policies.length >= 0
  });

  // Group policies and claims by customer
  const customerMap = {};
  
  policies.forEach(policy => {
    if (policy.customer_email) {
      if (!customerMap[policy.customer_email]) {
        customerMap[policy.customer_email] = {
          email: policy.customer_email,
          name: policy.customer_name,
          policies: [],
          claims: []
        };
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
          policies: [],
          claims: []
        };
      }
      customerMap[claim.customer_email].claims.push(claim);
    }
  });

  const customers = Object.values(customerMap);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (reProLoading || policiesLoading || claimsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (reProData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">You are not registered as a Real Estate Professional</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const rePro = reProData[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Building className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agent View</h1>
            <p className="text-sm text-slate-500">Your real estate professional dashboard</p>
          </div>
        </div>

        {/* Agent Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Your Agent Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Name</p>
                <p className="text-sm font-medium text-slate-900">{rePro.rep_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Type</p>
                <Badge className="bg-blue-100 text-blue-700">{rePro.rep_type}</Badge>
              </div>
              {rePro.brokerage && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Brokerage</p>
                  <p className="text-sm font-medium text-slate-900">{rePro.brokerage}</p>
                </div>
              )}
              {rePro.license_number && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">License #</p>
                  <p className="text-sm font-medium text-slate-900">{rePro.license_number}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-slate-500">Customers</p>
                  <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-500">Policies</p>
                  <p className="text-2xl font-bold text-slate-900">{policies.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-slate-500">Claims</p>
                  <p className="text-2xl font-bold text-slate-900">{claims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No customers found</p>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {customers.map((customer, idx) => (
                  <AccordionItem key={idx} value={`customer-${idx}`} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600">
                            {customer.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-slate-900">{customer.name}</p>
                          <p className="text-xs text-slate-500">{customer.email}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-3 text-sm mr-4">
                          <span className="text-slate-600">
                            <Shield className="h-4 w-4 inline mr-1" />
                            {customer.policies.length}
                          </span>
                          <span className="text-slate-600">
                            <FileText className="h-4 w-4 inline mr-1" />
                            {customer.claims.length}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-4">
                      {/* Policies */}
                      {customer.policies.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-slate-900 mb-2">Policies</h4>
                          <div className="space-y-2">
                            {customer.policies.map((policy) => (
                              <div key={policy.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                                <div className="flex items-start justify-between mb-1">
                                  <div>
                                    <p className="font-medium text-slate-900">#{policy.policy_number}</p>
                                    <p className="text-xs text-slate-500">{policy.policy_name}</p>
                                  </div>
                                  <Badge className={statusColors[policy.policy_status] || statusColors.Pending}>
                                    {policy.policy_status}
                                  </Badge>
                                </div>
                                {policy.property_address && (
                                  <p className="text-xs text-slate-500 mt-1">{policy.property_address}</p>
                                )}
                                {(policy.buyer_agent_email === user?.email || policy.listing_agent_email === user?.email || policy.title_escrow_email === user?.email) && (
                                 <div className="flex gap-2 mt-2">
                                   {policy.buyer_agent_email === user?.email && (
                                     <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Buyer Agent</Badge>
                                   )}
                                   {policy.listing_agent_email === user?.email && (
                                     <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Listing Agent</Badge>
                                   )}
                                   {policy.title_escrow_email === user?.email && (
                                     <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">Title/Escrow</Badge>
                                   )}
                                 </div>
                                )}
                                <div className="flex gap-3 text-xs text-slate-500 mt-2">
                                 {policy.effective_date && <span>Effective: {formatDate(policy.effective_date)}</span>}
                                 {policy.expiration_date && <span>Expires: {formatDate(policy.expiration_date)}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Claims */}
                      {customer.claims.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-slate-900 mb-2">Claims</h4>
                          <div className="space-y-2">
                            {customer.claims.map((claim) => (
                              <div key={claim.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                                <div className="flex items-start justify-between mb-1">
                                  <div>
                                    <p className="font-medium text-slate-900">#{claim.claim_name}</p>
                                    {claim.claim_type && <p className="text-xs text-slate-500">{claim.claim_type}</p>}
                                  </div>
                                  <Badge className={statusColors[claim.claim_status] || statusColors.Pending}>
                                    {claim.claim_status}
                                  </Badge>
                                </div>
                                {claim.customer_facing_description && (
                                  <p className="text-xs text-slate-600 mt-1">{claim.customer_facing_description}</p>
                                )}
                                {claim.claim_date && (
                                  <p className="text-xs text-slate-500 mt-2">Filed: {formatDate(claim.claim_date)}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}