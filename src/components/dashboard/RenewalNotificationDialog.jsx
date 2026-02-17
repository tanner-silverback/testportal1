import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CreditCard, X } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function RenewalNotificationDialog({ open, onOpenChange, policy }) {
  if (!policy) return null;

  const expirationDate = policy.expiration_date ? parseISO(policy.expiration_date) : null;
  const daysUntilExpiration = expirationDate ? differenceInDays(expirationDate, new Date()) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <DialogTitle className="text-xl">Policy Renewal Required</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-3">
            Your policy <strong>#{policy.policy_number}</strong> is expiring soon
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-amber-700" />
              <p className="font-semibold text-amber-900">
                {daysUntilExpiration} days until expiration
              </p>
            </div>
            <p className="text-sm text-amber-800">
              {expirationDate && `Expires: ${format(expirationDate, 'MMMM d, yyyy')}`}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              Don't let your coverage lapse! Renew now to ensure continuous protection for your home.
            </p>
            <p className="text-xs text-slate-500">
              For questions about renewal, call us at (801) 686-8927
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Remind Me Later
          </Button>
          <Button
            onClick={() => window.open('https://silverbackhw.com/order-policy', '_blank')}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Renew Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}