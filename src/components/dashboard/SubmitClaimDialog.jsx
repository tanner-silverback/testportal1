import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Active (Not Renewing)": "bg-amber-100 text-amber-700 border-amber-200",
  "Active Pending Payment": "bg-purple-100 text-purple-700 border-purple-200",
};

const normalizeStatus = (status) => {
  if (!status) return 'Pending';
  if (status === 'Do Not Renew' || status === 'Not Renewing') {
    return 'Active (Not Renewing)';
  }
  return status;
};

export default function SubmitClaimDialog({ open, onOpenChange, policies = [] }) {
  const [selectedPolicyId, setSelectedPolicyId] = useState('');

  // Filter to only active policies
  const activePolicies = policies.filter(p => {
    const status = normalizeStatus(p.policy_status);
    return status === 'Active' || status === 'Active (Not Renewing)' || status === 'Active Pending Payment';
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const selectedPolicy = activePolicies.find(p => p.id === selectedPolicyId);
    if (!selectedPolicy) return;

    // Construct the URL with policy information
    const baseUrl = 'YOUR_CLAIM_FORM_URL_HERE'; // Replace with actual URL
    const params = new URLSearchParams({
      policy_number: selectedPolicy.policy_number || '',
      policy_name: selectedPolicy.policy_name || '',
      customer_name: selectedPolicy.customer_name || '',
      customer_email: selectedPolicy.customer_email || '',
      customer_phone: selectedPolicy.customer_phone || '',
      property_address: selectedPolicy.property_address || '',
    });

    // Open in new tab
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
    
    // Close dialog
    onOpenChange(false);
    setSelectedPolicyId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Submit New Claim
          </DialogTitle>
        </DialogHeader>

        {activePolicies.length === 0 ? (
          <div className="py-8 text-center">
            <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
              <FileText className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Active Policies</h3>
            <p className="text-slate-600">
              You need an active policy to submit a claim.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="policy">Select Policy *</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId} required>
                <SelectTrigger id="policy">
                  <SelectValue placeholder="Choose a policy" />
                </SelectTrigger>
                <SelectContent>
                  {activePolicies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      <div className="flex items-center justify-between gap-3 py-1">
                        <div>
                          <p className="font-medium">Policy #{policy.policy_number}</p>
                          <p className="text-xs text-slate-500">{policy.property_address}</p>
                        </div>
                        <Badge className={statusColors[normalizeStatus(policy.policy_status)]}>
                          {normalizeStatus(policy.policy_status)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Select the policy for which you want to submit a claim
              </p>
            </div>

            {selectedPolicyId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Next Steps</h4>
                    <p className="text-sm text-blue-700">
                      You'll be redirected to our claim submission form with your policy information pre-filled. Complete the form to submit your claim.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-slate-900 hover:bg-slate-800"
                disabled={!selectedPolicyId}
              >
                Continue to Claim Form
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}