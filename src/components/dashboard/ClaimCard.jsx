import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, User, Mail, Calendar, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Active: "bg-blue-100 text-blue-700 border-blue-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  Completed: "bg-slate-100 text-slate-600 border-slate-200",
  Denied: "bg-red-100 text-red-700 border-red-200",
  Pending: "bg-purple-100 text-purple-700 border-purple-200"
};

export default function ClaimCard({ claim }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MM/dd/yy');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-slate-800 to-slate-600" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Claim</p>
            <p className="text-lg font-semibold text-slate-900">#{claim.claim_name}</p>
          </div>
          <Badge className={`${statusColors[claim.claim_status] || statusColors.Pending} font-medium`}>
            {claim.claim_status || 'Pending'}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-xs text-slate-400">Created: </span>
              <span className="text-sm text-slate-700">{formatDate(claim.claim_date)}</span>
            </div>
          </div>

          {claim.claim_type && (
            <div className="flex items-center gap-3">
              <Wrench className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-xs text-slate-400">Type: </span>
                <span className="text-sm text-slate-700">{claim.claim_type}</span>
              </div>
            </div>
          )}

          {claim.contractor && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-xs text-slate-400">Contractor: </span>
                <span className="text-sm text-slate-700">{claim.contractor}</span>
              </div>
            </div>
          )}

          {claim.contractor_email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <a 
                href={`mailto:${claim.contractor_email}`}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {claim.contractor_email}
              </a>
            </div>
          )}
        </div>

        {claim.customer_facing_description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{claim.customer_facing_description}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}