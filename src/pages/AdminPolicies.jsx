import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Loader2, Plus, Pencil, Trash2, Shield, Search, X, ChevronDown, ChevronRight, FileText, RefreshCw
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700",
  "Active Pending Payment": "bg-purple-100 text-purple-700",
  Expired: "bg-slate-100 text-slate-600",
  Cancelled: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700"
};

const emptyPolicy = {
  policy_number: '',
  policy_name: '',
  add_ons: [],
  policy_status: 'Active',
  effective_date: '',
  expiration_date: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  property_address: '',
  zoho_id: ''
};

const addOnOptions = [
  "Additional Sq Ft",
  "No-Fault Coverage",
  "Additional Refrigerator",
  "AC",
  "Furnace",
  "Listing HVAC",
  "AC Protection",
  "Sprinkler Timer & System",
  "Additional Water heater",
  "2nd Kitchen",
  "Re-Key",
  "Central Vacuum",
  "Swimming Pool and Hot Tub",
  "Pool",
  "Water Softener",
  "Septic System and Pumping",
  "Booster Pump / Sump Pump",
  "Grinder Pump/Sewer Ejector",
  "Water/Gas/Sewage Line Coverage",
  "Brand For Brand (Appliances)",
  "Boiler System",
  "Stand Alone Freezer"
];

export default function AdminPolicies() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState(emptyPolicy);
  const [expandedPolicyId, setExpandedPolicyId] = useState(null);
  const queryClient = useQueryClient();

  // Handle URL parameter for filtering
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const policyNumber = params.get('policy');
    if (policyNumber) {
      setSearchTerm(policyNumber);
    }
  }, []);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['admin-policies'],
    queryFn: () => base44.entities.Policy.list('-created_date'),
  });

  const { data: allClaims = [] } = useQuery({
    queryKey: ['admin-claims-for-policies'],
    queryFn: () => base44.entities.Claim.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Policy.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-policies'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Policy.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-policies'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Policy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-policies'] });
    },
  });

  const resetForm = () => {
    setFormData(emptyPolicy);
    setEditingPolicy(null);
  };

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      policy_number: policy.policy_number || '',
      policy_name: policy.policy_name || '',
      add_ons: policy.add_ons || [],
      policy_status: policy.policy_status || 'Active',
      effective_date: policy.effective_date || '',
      expiration_date: policy.expiration_date || '',
      customer_name: policy.customer_name || '',
      customer_email: policy.customer_email || '',
      customer_phone: policy.customer_phone || '',
      property_address: policy.property_address || '',
      zoho_id: policy.zoho_id || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredPolicies = policies.filter(policy => 
    policy.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-policies'] });
    queryClient.invalidateQueries({ queryKey: ['admin-claims-for-policies'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-xl">Manage Policies</CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search policies..."
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
                  <Plus className="h-4 w-4 mr-2" /> Add Policy
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
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => {
                      const policyClaims = allClaims.filter(c => 
                        c.policy_id && policy.policy_number && 
                        String(c.policy_id).trim() === String(policy.policy_number).trim()
                      );
                      const isExpanded = expandedPolicyId === policy.id;
                      
                      return (
                        <React.Fragment key={policy.id}>
                          <TableRow className="hover:bg-slate-50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setExpandedPolicyId(isExpanded ? null : policy.id)}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link 
                                to={createPageUrl(`AdminPolicies?policy=${policy.policy_number}`)}
                                className="text-slate-900 hover:text-blue-600 hover:underline"
                              >
                                {policy.policy_number}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link 
                                to={createPageUrl(`AdminCustomers?email=${policy.customer_email}`)}
                                className="hover:text-blue-600"
                              >
                                <div>
                                  <p className="font-medium hover:underline">{policy.customer_name || '—'}</p>
                                  <p className="text-sm text-slate-500 hover:underline">{policy.customer_email}</p>
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>{policy.customer_phone || '—'}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">Plan: {policy.policy_name || '—'}</p>
                                {policy.add_ons && policy.add_ons.length > 0 && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Add Ons: {policy.add_ons.join(', ')}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[policy.policy_status] || statusColors.Pending}>
                                {policy.policy_status || 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(policy.effective_date)}</TableCell>
                            <TableCell>{formatDate(policy.expiration_date)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleEdit(policy)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => deleteMutation.mutate(policy.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-slate-50 p-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                                    <FileText className="h-4 w-4" />
                                    Associated Claims ({policyClaims.length})
                                  </div>
                                  {policyClaims.length > 0 ? (
                                    <div className="space-y-2">
                                      {policyClaims.map(claim => (
                                        <div key={claim.id} className="bg-white rounded-lg p-3 border border-slate-200">
                                          <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                              <Link 
                                                to={createPageUrl(`AdminClaims?claim=${claim.claim_name}`)}
                                                className="font-medium text-sm text-slate-900 hover:text-blue-600 hover:underline"
                                              >
                                                {claim.claim_name}
                                              </Link>
                                              <p className="text-xs text-slate-500">{claim.claim_type}</p>
                                              {claim.contractor && (
                                                <p className="text-xs text-slate-600">Contractor: {claim.contractor}</p>
                                              )}
                                              <p className="text-xs text-slate-400">Policy ID on claim: {claim.policy_id || 'Not set'}</p>
                                            </div>
                                            <Badge className={`text-xs ${
                                              claim.claim_status === 'Completed' ? 'bg-green-100 text-green-700' :
                                              claim.claim_status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                              claim.claim_status === 'Denied' ? 'bg-red-100 text-red-700' :
                                              'bg-amber-100 text-amber-700'
                                            }`}>
                                              {claim.claim_status}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-slate-500 bg-white rounded-lg p-4 border border-slate-200">
                                      No claims found for policy #{policy.policy_number}
                                      <div className="text-xs text-slate-400 mt-2">
                                        Looking for claims with policy_id = "{policy.policy_number}"
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredPolicies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                          No policies found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policy Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Add New Policy'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Policy Number *</Label>
                <Input
                  value={formData.policy_number}
                  onChange={(e) => setFormData({...formData, policy_number: e.target.value})}
                  placeholder="56940"
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input
                  value={formData.policy_name}
                  onChange={(e) => setFormData({...formData, policy_name: e.target.value})}
                  placeholder="King Kong"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  placeholder="John Doe"
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
                <Label>Policy Status</Label>
                <Select
                  value={formData.policy_status}
                  onValueChange={(value) => setFormData({...formData, policy_status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Active Pending Payment">Active Pending Payment</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({...formData, expiration_date: e.target.value})}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Property Address</Label>
                <Input
                  value={formData.property_address}
                  onChange={(e) => setFormData({...formData, property_address: e.target.value})}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Add Ons</Label>
                <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                  {addOnOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={option}
                        checked={formData.add_ons?.includes(option)}
                        onCheckedChange={(checked) => {
                          const newAddOns = checked
                            ? [...(formData.add_ons || []), option]
                            : (formData.add_ons || []).filter(item => item !== option);
                          setFormData({...formData, add_ons: newAddOns});
                        }}
                      />
                      <label
                        htmlFor={option}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
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
                {editingPolicy ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}