import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Shield, Loader2, Calendar, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import PolicyActionButtons from '../components/dashboard/PolicyActionButtons';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700",
  "Active Pending Payment": "bg-purple-100 text-purple-700",
  Expired: "bg-slate-100 text-slate-600",
  Cancelled: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700"
};

export default function Policies() {
  const [user, setUser] = React.useState(null);

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

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['my-policies', customerEmail, viewAsEmail, user?.role],
    queryFn: async () => {
      if (viewAsEmail && user?.role === 'admin') {
        return base44.asServiceRole.entities.Policy.filter({ customer_email: viewAsEmail });
      }
      return base44.entities.Policy.filter({ customer_email: user.email });
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
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Policies</h1>
            <p className="text-sm text-slate-500">View all your home warranty policies</p>
          </div>
        </div>

        {policies.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No policies found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <Card key={policy.id} className="border-0 shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Policy #{policy.policy_number}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1"><strong>Plan:</strong> {policy.policy_name || '—'}</p>
                      {policy.add_ons && policy.add_ons.length > 0 && (
                        <p className="text-sm text-slate-500 mt-1">
                          <strong>Add Ons:</strong> {policy.add_ons.join(', ')}
                        </p>
                      )}
                    </div>
                    <Badge className={statusColors[policy.policy_status] || statusColors.Pending}>
                      {policy.policy_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">

                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Effective Date
                      </p>
                      <p className="text-sm font-medium text-slate-900">{formatDate(policy.effective_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Expiration Date
                      </p>
                      <p className="text-sm font-medium text-slate-900">{formatDate(policy.expiration_date)}</p>
                    </div>
                  </div>

                  {policy.property_address && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Property Address</p>
                      <p className="text-sm text-slate-700">{policy.property_address}</p>
                    </div>
                  )}

                  <PolicyActionButtons policy={policy} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}