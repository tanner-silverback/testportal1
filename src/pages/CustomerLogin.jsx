import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from '../utils';

export default function CustomerLogin() {
  useEffect(() => {
    // Redirect to login, then back to dashboard
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="pt-16 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69443e7d41ac045a66db022e/f5a4a3ed8_SBLogo.jpg" 
              alt="SilverBack Home Warranty" 
              className="h-16 w-16 object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Redirecting to Login</h2>
          <p className="text-slate-600 mb-6">
            Taking you to the customer portal...
          </p>
          <Loader2 className="h-6 w-6 animate-spin text-slate-600 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}