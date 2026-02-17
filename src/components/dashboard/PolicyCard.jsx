import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Calendar, FileText, User } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expired: "bg-slate-100 text-slate-600 border-slate-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  Pending: "bg-amber-100 text-amber-700 border-amber-200"
};

export default function PolicyCard({ policy }) {
  if (!policy) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">Policy Details</CardTitle>
          </div>
          <Badge className={`${statusColors[policy.policy_status] || statusColors.Pending} font-medium px-3 py-1`}>
            {policy.policy_status || 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Policy Number</p>
              <p className="text-lg font-semibold text-slate-900">{policy.policy_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Policy Name</p>
              <p className="text-base text-slate-700">{policy.policy_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Details of Coverage</p>
              <p className="text-base text-slate-700 whitespace-pre-line">{policy.details_of_coverage || '—'}</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-slate-400 mt-1" />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Effective Date</p>
                <p className="text-base text-slate-700">{formatDate(policy.effective_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-slate-400 mt-1" />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Expiration Date</p>
                <p className="text-base text-slate-700">{formatDate(policy.expiration_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-slate-400 mt-1" />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Customer</p>
                <p className="text-base text-slate-700">{policy.customer_name || '—'}</p>
              </div>
            </div>
            {policy.property_address && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Property Address</p>
                  <p className="text-base text-slate-700">{policy.property_address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}