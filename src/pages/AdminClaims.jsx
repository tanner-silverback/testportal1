import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Loader2, Plus, Pencil, Trash2, FileText, Search, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';

const statusColors = {
  Active: "bg-blue-100 text-blue-700",
  Approved: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Completed: "bg-slate-100 text-slate-600",
  Denied: "bg-red-100 text-red-700",
  Pending: "bg-purple-100 text-purple-700"
};

const emptyClaim = {
  claim_name: '',
  policy_id: '',
  customer_email: '',
  customer_phone: '',
  claim_type: '',
  claim_status: 'Pending',
  contractor: '',
  contractor_email: '',
  property_address: '',
  customer_facing_description: '',
  claim_date: '',
  zoho_id: ''
};

export default function AdminClaims() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [formData, setFormData] = useState(emptyClaim);
  const queryClient = useQueryClient();

  // Handle URL parameter for filtering
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimName = params.get('claim');
    if (claimName) {
      setSearchTerm(claimName);
    }
  }, []);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['admin-claims'],
    queryFn: () => base44.entities.Claim.list('-created_date'),
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['admin-policies-for-claims'],
    queryFn: () => base44.entities.Policy.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Claim.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Claim.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Claim.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
    },
  });

  const resetForm = () => {
    setFormData(emptyClaim);
    setEditingClaim(null);
  };

  const handleEdit = (claim) => {
    setEditingClaim(claim);
    setFormData({
      claim_name: claim.claim_name || '',
      policy_id: claim.policy_id || '',
      customer_email: claim.customer_email || '',
      customer_phone: claim.customer_phone || '',
      claim_type: claim.claim_type || '',
      claim_status: claim.claim_status || 'Pending',
      contractor: claim.contractor || '',
      contractor_email: claim.contractor_email || '',
      property_address: claim.property_address || '',
      customer_facing_description: claim.customer_facing_description || '',
      claim_date: claim.claim_date || '',
      zoho_id: claim.zoho_id || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingClaim) {
      updateMutation.mutate({ id: editingClaim.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredClaims = claims.filter(claim => 
    claim.claim_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.claim_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPolicyForClaim = (claim) => {
    if (!claim.policy_id) return null;
    return policies.find(p => 
      String(p.policy_number).trim() === String(claim.policy_id).trim()
    );
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
    queryClient.invalidateQueries({ queryKey: ['admin-policies-for-claims'] });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-xl">Manage Claims</CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search claims..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button 
                  onClick={() => { resetForm(); setIsDialogOpen(true); }}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Claim
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Claim #</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Customer Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClaims.map((claim) => {
                      const policy = getPolicyForClaim(claim);
                      return (
                        <TableRow key={claim.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium">
                            <Link 
                              to={createPageUrl(`AdminClaims?claim=${claim.claim_name}`)}
                              className="text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {claim.claim_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {claim.policy_id ? (
                              <Link 
                                to={createPageUrl(`AdminPolicies?policy=${claim.policy_id}`)}
                                className="hover:text-blue-600"
                              >
                                <div>
                                  <p className="text-slate-900 hover:underline">{claim.policy_id}</p>
                                  {policy && (
                                    <p className="text-xs text-slate-500">{policy.policy_name}</p>
                                  )}
                                </div>
                              </Link>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Link 
                              to={createPageUrl(`AdminCustomers?email=${claim.customer_email}`)}
                              className="text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {claim.customer_email}
                            </Link>
                          </TableCell>
                          <TableCell>{claim.customer_phone || '—'}</TableCell>
                          <TableCell>{claim.claim_type || '—'}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[claim.claim_status] || statusColors.Pending}>
                              {claim.claim_status || 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>{claim.contractor || '—'}</TableCell>
                          <TableCell>{formatDate(claim.claim_date)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(claim)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => deleteMutation.mutate(claim.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredClaims.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                          No claims found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClaim ? 'Edit Claim' : 'Add New Claim'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Claim Name/Number *</Label>
                <Input
                  value={formData.claim_name}
                  onChange={(e) => setFormData({...formData, claim_name: e.target.value})}
                  placeholder="29842"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Email *</Label>
                <Input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                  placeholder="customer@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Phone</Label>
                <Input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                  placeholder="(801) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label>Claim Type</Label>
                <Input
                  value={formData.claim_type}
                  onChange={(e) => setFormData({...formData, claim_type: e.target.value})}
                  placeholder="AC, Plumbing, Electrical..."
                />
              </div>
              <div className="space-y-2">
                <Label>Claim Status</Label>
                <Select
                  value={formData.claim_status}
                  onValueChange={(value) => setFormData({...formData, claim_status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Denied">Denied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Claim Date</Label>
                <Input
                  type="date"
                  value={formData.claim_date}
                  onChange={(e) => setFormData({...formData, claim_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Zoho ID</Label>
                <Input
                  value={formData.zoho_id}
                  onChange={(e) => setFormData({...formData, zoho_id: e.target.value})}
                  placeholder="Zoho CRM Reference"
                />
              </div>
              <div className="space-y-2">
                <Label>Contractor</Label>
                <Input
                  value={formData.contractor}
                  onChange={(e) => setFormData({...formData, contractor: e.target.value})}
                  placeholder="Contractor name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contractor Email</Label>
                <Input
                  type="email"
                  value={formData.contractor_email}
                  onChange={(e) => setFormData({...formData, contractor_email: e.target.value})}
                  placeholder="contractor@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Policy #</Label>
                <Input
                  value={formData.policy_id}
                  onChange={(e) => setFormData({...formData, policy_id: e.target.value})}
                  placeholder="Associated policy #"
                />
              </div>
              <div className="space-y-2">
                <Label>Property Address</Label>
                <Input
                  value={formData.property_address}
                  onChange={(e) => setFormData({...formData, property_address: e.target.value})}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer Facing Description</Label>
                <Textarea
                  value={formData.customer_facing_description}
                  onChange={(e) => setFormData({...formData, customer_facing_description: e.target.value})}
                  placeholder="Description visible to the customer..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="bg-slate-900 hover:bg-slate-800"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingClaim ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}