import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ClaimCancellationDialog({ open, onOpenChange, claim, policy, customerName, customerEmail }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('requestClaimCancellation', {
        claim,
        policy,
        customerName,
        customerEmail
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting cancellation request:', error);
      alert('Failed to submit cancellation request. Please try again or contact support.');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setSubmitting(false);
    }, 300);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl mb-2">Request Submitted</DialogTitle>
              <DialogDescription className="text-base">
                Thank you for requesting cancellation. Our team will review your request and follow up within 48 business hours.
              </DialogDescription>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Request Claim Cancellation</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            Are you sure you want to request to cancel this claim? Once submitted the SilverBack Home Warranty team will review this request and follow up within 48 business hours.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
          <div>
            <span className="text-slate-500">Claim:</span>
            <span className="font-medium text-slate-900 ml-2">#{claim?.claim_name}</span>
          </div>
          {claim?.claim_type && (
            <div>
              <span className="text-slate-500">Type:</span>
              <span className="font-medium text-slate-900 ml-2">{claim.claim_type}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}