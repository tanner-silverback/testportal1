import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, Mail, Phone, RefreshCw, Loader2, Plus, Search, Trash2, Shield, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminREPros() {
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [expandedREPros, setExpandedREPros] = useState({});

  const queryClient = useQueryClient();

  const { data: rePros = [], isLoading } = useQuery({
    queryKey: ['repros'],
    queryFn: () => base44.entities.REPro.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: () => base44.entities.Policy.list()
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.REPro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repros'] });
    }
  });

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus(null);
      
      const response = await base44.functions.invoke('zohoSyncREPros', {
        module: 'RE_Pros',
        limit: 3
      });

      // Check for errors in the response
      if (response.data?.error) {
        const errorMsg = response.data.details?.error_description || response.data.error;
        alert(`Sync failed: ${errorMsg}`);
        setSyncStatus({
          type: 'error',
          message: errorMsg
        });
        return;
      }
      
      setSyncStatus({
        type: 'success',
        message: `Synced ${response.data.total} RE Pros (${response.data.created} new, ${response.data.updated} updated)`
      });

      queryClient.invalidateQueries({ queryKey: ['repros'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to sync RE Pros';
      alert(`Sync failed: ${errorMsg}`);
      setSyncStatus({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this RE Pro?')) return;
    deleteMutation.mutate(id);
  };

  const filteredREPros = rePros.filter(rep => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return rep.rep_name?.toLowerCase().includes(term) || 
           rep.rep_email?.toLowerCase().includes(term) ||
           rep.brokerage?.toLowerCase().includes(term);
  });

  // Get user tag for each RE Pro
  const getUserTag = (email) => {
    const user = users.find(u => u.email === email);
    return user?.customer_type || 'RE Pro';
  };

  const tagColors = {
    'Customer': 'bg-blue-100 text-blue-700',
    'RE Pro': 'bg-purple-100 text-purple-700',
    'Combo': 'bg-green-100 text-green-700'
  };

  const statusColors = {
    Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Expired: "bg-red-100 text-red-700 border-red-200",
    Cancelled: "bg-red-100 text-red-700 border-red-200",
    Pending: "bg-amber-100 text-amber-700 border-amber-200",
    "Active Pending Payment": "bg-purple-100 text-purple-700 border-purple-200",
  };

  const getRelatedPolicies = (reProZohoId) => {
    return policies.filter(p => 
      p.re_pro_ids && p.re_pro_ids.includes(reProZohoId)
    );
  };

  const getClaimsForPolicy = (policyNumber) => {
    return claims.filter(c => c.policy_id === policyNumber);
  };

  const toggleExpand = (repId) => {
    setExpandedREPros(prev => ({
      ...prev,
      [repId]: !prev[repId]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <Building className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">RE Professionals</h1>
              <p className="text-sm text-slate-500">Manage real estate professionals</p>
            </div>
          </div>
          <Button 
            onClick={handleSync}
            disabled={syncing}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Zoho
          </Button>
        </div>

        {/* Status */}
        {syncStatus && (
          <Alert className={syncStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={syncStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {syncStatus.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by name, email, or brokerage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* RE Pros List */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">All RE Professionals ({filteredREPros.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredREPros.length === 0 ? (
              <div className="text-center py-12">
                <Building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No RE Professionals found</p>
                <Button 
                  onClick={handleSync}
                  disabled={syncing}
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync from Zoho
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredREPros.map((rep) => {
                  const relatedPolicies = getRelatedPolicies(rep.zoho_id);
                  const isExpanded = expandedREPros[rep.id];
                  
                  return (
                    <div key={rep.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {relatedPolicies.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(rep.id)}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            )}
                            <h3 className="font-semibold text-slate-900">{rep.rep_name}</h3>
                            <Badge className={tagColors[getUserTag(rep.rep_email)]}>
                              {getUserTag(rep.rep_email)}
                            </Badge>
                            {rep.rep_type && (
                              <Badge className="bg-blue-100 text-blue-700">{rep.rep_type}</Badge>
                            )}
                            {relatedPolicies.length > 0 && (
                              <Badge className="bg-slate-100 text-slate-700">
                                <Shield className="h-3 w-3 mr-1" />
                                {relatedPolicies.length} {relatedPolicies.length === 1 ? 'Policy' : 'Policies'}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-slate-600">
                            {rep.rep_email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                {rep.rep_email}
                              </div>
                            )}
                            {rep.rep_phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {rep.rep_phone}
                              </div>
                            )}
                            {rep.brokerage && (
                              <div className="flex items-center gap-2">
                                <Building className="h-3 w-3" />
                                {rep.brokerage}
                              </div>
                            )}
                            {rep.license_number && (
                              <div className="text-xs text-slate-500">
                                License: {rep.license_number}
                              </div>
                            )}
                          </div>

                          {/* Related Policies */}
                          {isExpanded && relatedPolicies.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <h4 className="text-sm font-semibold text-slate-700 mb-3">Related Policies</h4>
                              <div className="space-y-2">
                                {relatedPolicies.map((policy) => {
                                  const policyClaims = getClaimsForPolicy(policy.policy_number);
                                  const totalUsage = policyClaims.reduce((sum, claim) => {
                                    // Calculate total usage from claims if available
                                    return sum + (claim.claim_amount || 0);
                                  }, 0);

                                  return (
                                    <div key={policy.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-900">#{policy.policy_number}</span>
                                            <Badge className={statusColors[policy.policy_status] || statusColors.Pending}>
                                              {policy.policy_status}
                                            </Badge>
                                          </div>
                                          {policy.policy_name && (
                                            <p className="text-xs text-slate-600 mt-1">{policy.policy_name}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                          <p className="text-slate-500">Claims</p>
                                          <p className="font-medium text-slate-900 flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            {policyClaims.length}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500">Total Usage</p>
                                          <p className="font-medium text-slate-900">
                                            ${totalUsage.toLocaleString()}
                                          </p>
                                        </div>
                                      </div>
                                      {policy.customer_name && (
                                        <p className="text-xs text-slate-600 mt-2">
                                          Customer: {policy.customer_name}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rep.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}