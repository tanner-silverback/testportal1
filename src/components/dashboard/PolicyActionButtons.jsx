import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays, parseISO } from 'date-fns';

export default function PolicyActionButtons({ policy }) {
  // Check if policy is expired or cancelled
  const isExpired = policy.policy_status === 'Expired' || policy.policy_status === 'Cancelled' || 
    (policy.expiration_date && new Date(policy.expiration_date) < new Date());

  // Check if within first 30 days (for add-ons and cancellation)
  const effectiveDate = policy.effective_date ? parseISO(policy.effective_date) : null;
  const daysSinceEffective = effectiveDate ? differenceInDays(new Date(), effectiveDate) : 999;
  const isWithinFirst30Days = daysSinceEffective <= 30 && daysSinceEffective >= 0;

  // Check if within 60 days of expiration (for renewal)
  const expirationDate = policy.expiration_date ? parseISO(policy.expiration_date) : null;
  const daysUntilExpiration = expirationDate ? differenceInDays(expirationDate, new Date()) : 999;
  const canRenew = !isExpired && daysUntilExpiration <= 60 && daysUntilExpiration > 0;

  const canAddAlaCarte = !isExpired && isWithinFirst30Days;
  const canCancel = !isExpired && isWithinFirst30Days;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
        {/* Renewal Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canRenew}
                onClick={canRenew ? () => window.open('https://silverbackhw.com/order-policy', '_blank') : undefined}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Renew Policy
              </Button>
            </span>
          </TooltipTrigger>
          {!canRenew && (
            <TooltipContent>
              <p>{isExpired ? 'This policy is expired, please reach out to SilverBack Home Warranty at (801)686-8927 for renewal options. Thank you!' : 'Renewal is available 60 days before expiration'}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Add A La Carte Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canAddAlaCarte}
                onClick={canAddAlaCarte ? () => window.open('https://silverbackhw.com/order-policy', '_blank') : undefined}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add A La Carte Items
              </Button>
            </span>
          </TooltipTrigger>
          {!canAddAlaCarte && (
            <TooltipContent>
              <p>{isExpired ? 'This policy is expired, please reach out to SilverBack Home Warranty at (801)686-8927 for renewal options. Thank you!' : 'A La Carte items can only be added within the first 30 days'}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Cancel Policy Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                variant="destructive" 
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canCancel}
                onClick={canCancel ? () => window.location.href = 'tel:8016868927' : undefined}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Policy
              </Button>
            </span>
          </TooltipTrigger>
          {!canCancel && (
            <TooltipContent>
              <p>{isExpired ? 'This policy is expired, please reach out to SilverBack Home Warranty at (801)686-8927 for renewal options. Thank you!' : 'Policy can only be cancelled within the first 30 days'}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}