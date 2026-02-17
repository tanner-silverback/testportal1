import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Cloud, CheckCircle2, AlertCircle, Loader2, RefreshCw, Link2, FileText, Shield, Mail, Users
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FieldMappingEditor from '../components/zoho/FieldMappingEditor';

export default function AdminZoho() {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [actualRedirectUri, setActualRedirectUri] = useState(null);
  const [refreshToken, setRefreshToken] = useState('');
  const [syncConfig, setSyncConfig] = useState({
    policyModule: 'Policies',
    claimModule: 'Claims',
    reProModule: 'RE_Pros',
    limit: 10,
    useLimitForPolicyDate: false,
    useLimitForClaimDate: false,
    useLimitForSinglePolicy: false,
    useLimitForSingleClaim: false,
    useLimitForREPro: false,
    policyFields: {},
    claimFields: {},
    policyDateField: 'Effective_Date',
    policyStartDate: '',
    policyEndDate: '',
    claimDateField: 'Created_Time',
    claimStartDate: '',
    claimEndDate: '',
    policyRecordId: '',
    claimRecordId: '',
    reProRecordId: ''
  });

  // Fetch the actual redirect URI on component mount
  React.useEffect(() => {
    const fetchRedirectUri = async () => {
      try {
        const { data } = await base44.functions.invoke('zohoAuth', { action: 'getAuthUrl' });
        if (data.redirectUri) {
          setActualRedirectUri(data.redirectUri);
        }
      } catch (err) {
        console.error('Failed to fetch redirect URI:', err);
      }
    };
    fetchRedirectUri();
  }, []);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await base44.functions.invoke('zohoAuth', { action: 'getAuthUrl' });
      
      if (!data.authUrl) {
        throw new Error(data.error || 'Failed to get auth URL');
      }
      
      // Show the exact redirect URI being used
      setDebugInfo({
        redirectUriUsed: data.redirectUri,
        message: 'This is the exact Redirect URI being sent to Zoho. Make sure it matches EXACTLY in your Zoho API Console.'
      });
      
      // Open Zoho OAuth in new window
      window.open(data.authUrl, '_blank');
      
      setSyncStatus({
        type: 'info',
        message: 'Follow the instructions in the new window to connect your Zoho account.'
      });
    } catch (err) {
      setError(err.message);
      setDebugInfo({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRefreshToken = async () => {
    if (!refreshToken.trim()) {
      setError('Please enter a refresh token');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data } = await base44.functions.invoke('zohoSaveRefreshToken', { 
        refreshToken: refreshToken.trim() 
      });
      
      setSyncStatus({
        type: 'success',
        message: 'Refresh token saved successfully! You can now sync your data.'
      });
      setRefreshToken('');
    } catch (err) {
      setError(err.message || 'Failed to save refresh token');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugTest = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);

      const user = await base44.auth.me();
      
      // Test with SDK
      const { data } = await base44.functions.invoke('zohoAuth', { action: 'getAuthUrl' });

      setDebugInfo({
        user: { email: user.email, role: user.role },
        method: 'base44.functions.invoke',
        functionName: 'zohoAuth',
        params: { action: 'getAuthUrl' },
        response: data,
        zohoClientIdSet: data.authUrl ? 'Yes (URL generated)' : 'No or Missing',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message);
      setDebugInfo({ 
        error: err.message, 
        stack: err.stack,
        method: 'base44.functions.invoke',
        user: { email: (await base44.auth.me()).email, role: (await base44.auth.me()).role }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPoliciesByEffectiveDate = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);
      
      // Step 1: Sync policies (which also syncs claims)
      const { data: policyData } = await base44.functions.invoke('zohoSyncPolicies', {
        module: syncConfig.policyModule,
        limit: syncConfig.useLimitForPolicyDate ? syncConfig.limit : undefined,
        fields: syncConfig.policyFields,
        dateField: syncConfig.policyDateField,
        startDate: syncConfig.policyStartDate,
        endDate: syncConfig.policyEndDate
      });

      // Step 2: Extract RE Pro IDs from synced policies and sync them
      const reProIds = new Set();
      if (policyData.debugInfo?.sampleRecord?.Re_Pros) {
        const rePros = policyData.debugInfo.sampleRecord.Re_Pros;
        if (Array.isArray(rePros)) {
          rePros.forEach(rp => reProIds.add(rp.id));
        } else if (rePros.id) {
          reProIds.add(rePros.id);
        }
      }

      let reProData = null;
      if (reProIds.size > 0) {
        const { data } = await base44.functions.invoke('zohoSyncREPros', {
          module: syncConfig.reProModule,
          recordIds: Array.from(reProIds)
        });
        reProData = data;
      }
      
      setSyncStatus({
        type: 'success',
        message: `Successfully synced ${policyData.total} policies by effective date (Policies: ${policyData.policies?.created || 0} created, ${policyData.policies?.updated || 0} updated; Claims: ${policyData.claims?.created || 0} created, ${policyData.claims?.updated || 0} updated${reProData ? `; RE Pros: ${reProData.created || 0} created, ${reProData.updated || 0} updated` : ''})`,
        details: { policies: policyData, rePros: reProData }
      });

      setDebugInfo({
        syncType: 'policies',
        availableFields: policyData.debugInfo?.availableFields || [],
        sampleRecord: policyData.debugInfo?.sampleRecord || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message || 'Failed to sync policies. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        function: 'zohoSyncPolicies (by effective date)',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSinglePolicy = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);
      
      // Parse input - split by newlines or commas, trim, and filter empty
      const recordIds = syncConfig.policyRecordId
        .split(/[\n,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (recordIds.length === 0) {
        setError('Please enter at least one policy number');
        setLoading(false);
        return;
      }

      // Step 1: Sync policies (which also syncs claims)
      const { data: policyData } = await base44.functions.invoke('zohoSyncPolicies', {
        module: syncConfig.policyModule,
        limit: syncConfig.useLimitForSinglePolicy ? syncConfig.limit : undefined,
        fields: syncConfig.policyFields,
        recordIds: recordIds
      });

      // Step 2: Extract RE Pro IDs from synced policies and sync them
      const reProIds = new Set();
      if (policyData.debugInfo?.sampleRecord?.Re_Pros) {
        const rePros = policyData.debugInfo.sampleRecord.Re_Pros;
        if (Array.isArray(rePros)) {
          rePros.forEach(rp => reProIds.add(rp.id));
        } else if (rePros.id) {
          reProIds.add(rePros.id);
        }
      }

      let reProData = null;
      if (reProIds.size > 0) {
        const { data } = await base44.functions.invoke('zohoSyncREPros', {
          module: syncConfig.reProModule,
          recordIds: Array.from(reProIds)
        });
        reProData = data;
      }
      
      setSyncStatus({
        type: 'success',
        message: `Successfully synced ${recordIds.length} policy/policies (Policies: ${policyData.policies?.created || 0} created, ${policyData.policies?.updated || 0} updated; Claims: ${policyData.claims?.created || 0} created, ${policyData.claims?.updated || 0} updated${reProData ? `; RE Pros: ${reProData.created || 0} created, ${reProData.updated || 0} updated` : ''})`,
        details: { policies: policyData, rePros: reProData }
      });

      setDebugInfo({
        syncType: 'policies',
        availableFields: policyData.debugInfo?.availableFields || [],
        sampleRecord: policyData.debugInfo?.sampleRecord || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message || 'Failed to sync policies. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        function: 'zohoSyncPolicies (multiple policies)',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClaimsByCreatedDate = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);
      
      const { data } = await base44.functions.invoke('zohoSyncClaims', {
        module: syncConfig.claimModule,
        limit: syncConfig.useLimitForClaimDate ? syncConfig.limit : undefined,
        fields: syncConfig.claimFields,
        dateField: syncConfig.claimDateField,
        startDate: syncConfig.claimStartDate,
        endDate: syncConfig.claimEndDate
      });
      
      setSyncStatus({
        type: 'success',
        message: `Successfully synced ${data.total} claims by created date (${data.created} new, ${data.updated} updated)`,
        details: data
      });
    } catch (err) {
      setError(err.message || 'Failed to sync claims. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        function: 'zohoSyncClaims (by created date)',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncREPros = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);

      // Parse input if provided - split by newlines or commas, trim, and filter empty
      let recordIds = undefined;
      if (syncConfig.reProRecordId && syncConfig.reProRecordId.trim()) {
        recordIds = syncConfig.reProRecordId
          .split(/[\n,]+/)
          .map(id => id.trim())
          .filter(id => id.length > 0);

        if (recordIds.length === 0) {
          setError('Please enter at least one RE Pro email');
          setLoading(false);
          return;
        }
      }
      
      const { data } = await base44.functions.invoke('zohoSyncREPros', {
        module: syncConfig.reProModule,
        limit: syncConfig.useLimitForREPro ? syncConfig.limit : undefined,
        recordIds: recordIds
      });
      
      setSyncStatus({
        type: 'success',
        message: recordIds 
          ? `Successfully synced ${recordIds.length} RE Pro(s) (${data.created || 0} created, ${data.updated || 0} updated)`
          : `Successfully synced ${data.total} RE Pros (${data.created || 0} created, ${data.updated || 0} updated)`,
        details: data
      });

      setDebugInfo({
        syncType: 'repros',
        availableFields: data.debugInfo?.availableFields || [],
        sampleRecord: data.debugInfo?.sampleRecord || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message || 'Failed to sync RE Pros. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        function: 'zohoSyncREPros',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSingleClaim = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);
      
      // Parse input - split by newlines or commas, trim, and filter empty
      const recordIds = syncConfig.claimRecordId
        .split(/[\n,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (recordIds.length === 0) {
        setError('Please enter at least one claim number');
        setLoading(false);
        return;
      }

      const { data } = await base44.functions.invoke('zohoSyncClaims', {
        module: syncConfig.claimModule,
        limit: syncConfig.useLimitForSingleClaim ? syncConfig.limit : undefined,
        fields: syncConfig.claimFields,
        recordIds: recordIds
      });
      
      setSyncStatus({
        type: 'success',
        message: `Successfully synced ${recordIds.length} claim(s) (${data.created || 0} created, ${data.updated || 0} updated)`,
        details: data
      });
    } catch (err) {
      setError(err.message || 'Failed to sync claims. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        function: 'zohoSyncClaims (multiple claims)',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);

      // Sync policies first
      const policiesResult = await base44.functions.invoke('zohoSyncPolicies', {
        module: syncConfig.policyModule,
        limit: syncConfig.limit,
        fields: syncConfig.policyFields,
        dateField: syncConfig.policyStartDate && syncConfig.policyEndDate ? syncConfig.policyDateField : undefined,
        startDate: syncConfig.policyStartDate || undefined,
        endDate: syncConfig.policyEndDate || undefined
      });

      // Then sync claims
      const claimsResult = await base44.functions.invoke('zohoSyncClaims', {
        module: syncConfig.claimModule,
        limit: syncConfig.limit,
        fields: syncConfig.claimFields,
        dateField: syncConfig.claimStartDate && syncConfig.claimEndDate ? syncConfig.claimDateField : undefined,
        startDate: syncConfig.claimStartDate || undefined,
        endDate: syncConfig.claimEndDate || undefined
      });

      setSyncStatus({
        type: 'success',
        message: 'Full sync completed successfully!',
        details: {
          policies: policiesResult.data,
          claims: claimsResult.data
        }
      });

      // Set debug info from policies
      if (policiesResult.data.debugInfo) {
        setDebugInfo({
          syncType: 'policies',
          availableFields: policiesResult.data.debugInfo.availableFields || [],
          sampleRecord: policiesResult.data.debugInfo.sampleRecord || null,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to sync data. Make sure ZOHO_REFRESH_TOKEN is set.');
      setDebugInfo({
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack,
        function: 'syncAll',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const getWebhookUrl = () => {
    return `${window.location.origin}/api/functions/zohoWebhook`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Cloud className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
            <p className="text-sm text-slate-500">Manage Zoho CRM and Gmail integrations</p>
          </div>
        </div>

        {/* Gmail Integration Status */}
        <Card className="border-0 shadow-sm bg-emerald-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="text-lg text-emerald-900 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-900">Gmail API Connected</span>
            </div>
            <p className="text-sm text-emerald-800">
              GMAIL_REFRESH_TOKEN is configured. The messaging system is using Gmail API to send emails.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://silver-back-home-warranty-portal-66db022e.base44.app/api/apps/69443e7d41ac045a66db022e/functions/getGmailRefreshToken', '_blank')}
              className="border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-authenticate Gmail
            </Button>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {syncStatus && (
          <Alert className={syncStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription className={syncStatus.type === 'success' ? 'text-green-800' : 'text-blue-800'}>
              {syncStatus.message}
              {syncStatus.details?.errors && syncStatus.details.errors.length > 0 && (
                <div className="mt-2 text-sm">
                  <strong>Errors:</strong>
                  <ul className="list-disc ml-4">
                    {syncStatus.details.errors.map((err, i) => (
                      <li key={i}>{err.policy || err.claim}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {debugInfo && debugInfo.syncType && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">Zoho Fields Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Available Fields in Zoho:</h4>
                <div className="bg-white p-3 rounded border border-blue-200 max-h-40 overflow-auto">
                  <pre className="text-xs">{JSON.stringify(debugInfo.availableFields, null, 2)}</pre>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Sample Record from Zoho:</h4>
                <div className="bg-white p-3 rounded border border-blue-200 max-h-96 overflow-auto">
                  <pre className="text-xs">{JSON.stringify(debugInfo.sampleRecord, null, 2)}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Panel */}
        <Card className="border-0 shadow-sm bg-slate-900 text-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Debug Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-300">
              Test the Zoho connection and see detailed error information
            </p>
            <Button 
              onClick={handleDebugTest} 
              disabled={loading}
              variant="outline"
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2" />
              )}
              Run Debug Test
            </Button>

            {debugInfo && (
              <div className="bg-slate-800 p-4 rounded-lg mt-4 overflow-auto">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redirect URI Configuration */}
        <Card className="border-0 shadow-sm bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg text-amber-900">⚠️ Important: Configure Redirect URI First</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-800">
              Before connecting, add this exact Redirect URI to your Zoho API Console:
            </p>
            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <p className="text-xs font-medium text-slate-500 mb-1">Redirect URI (copy this exactly):</p>
              <code className="text-sm text-slate-900 break-all font-mono">
                {actualRedirectUri || 'Loading...'}
              </code>
              {actualRedirectUri && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(actualRedirectUri);
                    setSyncStatus({ type: 'info', message: 'Redirect URI copied to clipboard!' });
                  }}
                >
                  📋 Copy Redirect URI
                </Button>
              )}
            </div>
            <div className="text-sm text-amber-800 space-y-2">
              <p><strong>Steps:</strong></p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Go to <a href="https://api-console.zoho.com/" target="_blank" className="text-blue-600 underline">Zoho API Console</a></li>
                <li>Open your Self Client application</li>
                <li>Click "Edit" and paste the Redirect URI above</li>
                <li>Save and return here to connect</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Connect Zoho Account</h3>
                  <p className="text-sm text-slate-600 mb-2">Authorize access to your Zoho CRM data</p>
                  <Button 
                    onClick={handleConnect} 
                    disabled={loading}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Zoho CRM
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">Save Refresh Token</h3>
                  <p className="text-sm text-slate-600 mb-3">After connecting, paste your refresh token here:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder="Paste your Zoho refresh token here..."
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <Button 
                      onClick={handleSaveRefreshToken} 
                      disabled={loading || !refreshToken.trim()}
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Sync Your Data</h3>
                  <p className="text-sm text-slate-600 mb-2">Pull most recent policies and claims from Zoho (based on record limit)</p>
                  <Button 
                    onClick={handleSyncAll} 
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync All Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Configuration */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sync Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Policy Module Name</label>
                <input
                  type="text"
                  value={syncConfig.policyModule}
                  onChange={(e) => setSyncConfig({...syncConfig, policyModule: e.target.value})}
                  placeholder="Policies"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Claim Module Name</label>
                <input
                  type="text"
                  value={syncConfig.claimModule}
                  onChange={(e) => setSyncConfig({...syncConfig, claimModule: e.target.value})}
                  placeholder="Claims"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Record Limit</label>
                <input
                  type="number"
                  value={syncConfig.limit}
                  onChange={(e) => setSyncConfig({...syncConfig, limit: parseInt(e.target.value)})}
                  min="1"
                  max="10000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <p className="text-xs text-slate-500">
                  Pull most recent records (1-10,000)
                  <br />
                  <span className="text-amber-600">API calls: ~{Math.ceil(syncConfig.limit / 200)} GET + ~{Math.ceil(syncConfig.limit / 100)} writes per module</span>
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sync Policies, RE Pros & Claims by Effective Date
              </h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-900">
                  Syncs policies within the date range along with their related RE Professionals and claims.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date Field Name</label>
                  <input
                    type="text"
                    value={syncConfig.policyDateField}
                    onChange={(e) => setSyncConfig({...syncConfig, policyDateField: e.target.value})}
                    placeholder="Effective_Date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={syncConfig.policyStartDate}
                    onChange={(e) => setSyncConfig({...syncConfig, policyStartDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={syncConfig.policyEndDate}
                    onChange={(e) => setSyncConfig({...syncConfig, policyEndDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="useLimitPolicyDate"
                  checked={syncConfig.useLimitForPolicyDate}
                  onChange={(e) => setSyncConfig({...syncConfig, useLimitForPolicyDate: e.target.checked})}
                  className="h-4 w-4"
                />
                <label htmlFor="useLimitPolicyDate" className="text-sm text-slate-700">
                  Apply record limit ({syncConfig.limit} records)
                </label>
              </div>
              <Button 
                onClick={handleSyncPoliciesByEffectiveDate}
                disabled={loading || !syncConfig.policyStartDate || !syncConfig.policyEndDate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                Sync Policies + RE Pros + Claims by Date
              </Button>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sync Policies, RE Pros & Claims (Recommended)
              </h4>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-900">
                    <strong>All-in-one sync:</strong> This will sync the specified policies along with their related RE Professionals and claims automatically.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Policy Number(s)</label>
                  <textarea
                    value={syncConfig.policyRecordId}
                    onChange={(e) => setSyncConfig({...syncConfig, policyRecordId: e.target.value})}
                    placeholder="Enter one or multiple policy numbers (one per line or comma-separated)&#10;e.g., 57918-2&#10;57919-1&#10;57920-3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500">
                    Enter policy numbers separated by commas or new lines
                  </p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="useLimitSinglePolicy"
                    checked={syncConfig.useLimitForSinglePolicy}
                    onChange={(e) => setSyncConfig({...syncConfig, useLimitForSinglePolicy: e.target.checked})}
                    className="h-4 w-4"
                  />
                  <label htmlFor="useLimitSinglePolicy" className="text-sm text-slate-700">
                    Apply record limit ({syncConfig.limit} records)
                  </label>
                </div>
                <Button 
                  onClick={handleSyncSinglePolicy}
                  disabled={loading || !syncConfig.policyRecordId}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  Sync Policies + RE Pros + Claims
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sync Policies Only
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Policy Number(s)</label>
                  <textarea
                    value={syncConfig.policyRecordId}
                    onChange={(e) => setSyncConfig({...syncConfig, policyRecordId: e.target.value})}
                    placeholder="Enter one or multiple policy numbers (one per line or comma-separated)&#10;e.g., 57918-2&#10;57919-1&#10;57920-3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500">
                    Sync only policies (claims pulled automatically, RE Pros excluded)
                  </p>
                </div>
                <Button 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);
                      setSyncStatus(null);
                      
                      const recordIds = syncConfig.policyRecordId
                        .split(/[\n,]+/)
                        .map(id => id.trim())
                        .filter(id => id.length > 0);

                      if (recordIds.length === 0) {
                        setError('Please enter at least one policy number');
                        setLoading(false);
                        return;
                      }

                      const { data } = await base44.functions.invoke('zohoSyncPolicies', {
                        module: syncConfig.policyModule,
                        fields: syncConfig.policyFields,
                        recordIds: recordIds
                      });
                      
                      setSyncStatus({
                        type: 'success',
                        message: `Successfully synced ${recordIds.length} policy/policies (Policies: ${data.policies?.created || 0} created, ${data.policies?.updated || 0} updated; Claims: ${data.claims?.created || 0} created, ${data.claims?.updated || 0} updated)`,
                        details: data
                      });
                    } catch (err) {
                      setError(err.message || 'Failed to sync policies.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !syncConfig.policyRecordId}
                  className="bg-slate-600 hover:bg-slate-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  Sync Policies Only
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Claim Sync by Created Date
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date Field Name</label>
                  <input
                    type="text"
                    value={syncConfig.claimDateField}
                    onChange={(e) => setSyncConfig({...syncConfig, claimDateField: e.target.value})}
                    placeholder="Created_Time"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={syncConfig.claimStartDate}
                    onChange={(e) => setSyncConfig({...syncConfig, claimStartDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={syncConfig.claimEndDate}
                    onChange={(e) => setSyncConfig({...syncConfig, claimEndDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="useLimitClaimDate"
                  checked={syncConfig.useLimitForClaimDate}
                  onChange={(e) => setSyncConfig({...syncConfig, useLimitForClaimDate: e.target.checked})}
                  className="h-4 w-4"
                />
                <label htmlFor="useLimitClaimDate" className="text-sm text-slate-700">
                  Apply record limit ({syncConfig.limit} records)
                </label>
              </div>
              <Button 
                onClick={handleSyncClaimsByCreatedDate}
                disabled={loading || !syncConfig.claimStartDate || !syncConfig.claimEndDate}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Sync Claims by Created Date
              </Button>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Claim Sync by Numbers
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Claim Number(s)</label>
                  <textarea
                    value={syncConfig.claimRecordId}
                    onChange={(e) => setSyncConfig({...syncConfig, claimRecordId: e.target.value})}
                    placeholder="Enter one or multiple claim numbers (one per line or comma-separated)&#10;e.g., 29842&#10;29843&#10;29844"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500">
                    Enter claim numbers separated by commas or new lines
                  </p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="useLimitSingleClaim"
                    checked={syncConfig.useLimitForSingleClaim}
                    onChange={(e) => setSyncConfig({...syncConfig, useLimitForSingleClaim: e.target.checked})}
                    className="h-4 w-4"
                  />
                  <label htmlFor="useLimitSingleClaim" className="text-sm text-slate-700">
                    Apply record limit ({syncConfig.limit} records)
                  </label>
                </div>
                <Button 
                  onClick={handleSyncSingleClaim}
                  disabled={loading || !syncConfig.claimRecordId}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Sync Claims
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                RE Professionals Sync (All Records)
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Module Name</label>
                  <input
                    type="text"
                    value={syncConfig.reProModule}
                    onChange={(e) => setSyncConfig({...syncConfig, reProModule: e.target.value})}
                    placeholder="RE_Pros"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Syncs RE Pros and tags users as Customer, RE Pro, or Combo
                  </p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="useLimitREPro"
                    checked={syncConfig.useLimitForREPro}
                    onChange={(e) => setSyncConfig({...syncConfig, useLimitForREPro: e.target.checked})}
                    className="h-4 w-4"
                  />
                  <label htmlFor="useLimitREPro" className="text-sm text-slate-700">
                    Apply record limit ({syncConfig.limit} records)
                  </label>
                </div>
                <Button 
                  onClick={handleSyncREPros}
                  disabled={loading}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                  Sync All RE Professionals
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                RE Pro Sync by Email
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">RE Pro Email(s) or Zoho ID(s)</label>
                  <textarea
                    value={syncConfig.reProRecordId}
                    onChange={(e) => setSyncConfig({...syncConfig, reProRecordId: e.target.value})}
                    placeholder="Enter emails or Zoho IDs (one per line or comma-separated)&#10;e.g., agent@example.com&#10;5725832000000387001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500">
                    Enter RE Pro emails or Zoho record IDs separated by commas or new lines
                  </p>
                </div>
                <Button 
                  onClick={handleSyncREPros}
                  disabled={loading || !syncConfig.reProRecordId}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                  Sync RE Pros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Webhook Setup */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Real-Time Updates (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Configure webhooks in Zoho CRM to automatically sync changes in real-time:
            </p>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-1">Webhook URL:</p>
              <code className="text-sm text-slate-700 break-all">{getWebhookUrl()}</code>
            </div>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>In Zoho CRM:</strong></p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Go to Setup → Automation → Workflow Rules</li>
                <li>Create workflows for Policies and Claims modules</li>
                <li>Add a webhook action with the URL above</li>
                <li>Trigger on Create, Update, and Delete events</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Field Mapping Editors */}
        <div className="space-y-6">
          <FieldMappingEditor moduleType="Policy" />
          <FieldMappingEditor moduleType="Claim" />
        </div>

        {/* Current Default Mapping Reference */}
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardHeader>
            <CardTitle className="text-lg">Default Field Mappings (if no custom mappings set)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Policies Module</h4>
              <div className="text-sm text-slate-600 space-y-1">
                <p>• <strong>Name</strong> → policy_id</p>
                <p>• <strong>Policy_Number</strong> → policy_number</p>
                <p>• <strong>Plan_Name</strong> → policy_name</p>
                <p>• <strong>Options</strong> → details_of_coverage</p>
                <p>• <strong>Status</strong> → policy_status</p>
                <p>• <strong>Effective_Date</strong> → effective_date</p>
                <p>• <strong>Expiration_Date</strong> → expiration_date</p>
                <p>• <strong>Customer.name</strong> → customer_name</p>
                <p>• <strong>Email</strong> → customer_email</p>
                <p>• <strong>Address_1, Address_2, City, State, Zip</strong> → property_address</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Claims Module</h4>
              <div className="text-sm text-slate-600 space-y-1">
                <p>• <strong>Claim_Number or Name</strong> → claim_name</p>
                <p>• <strong>Policy_Name.Policy_Number</strong> → policy_id</p>
                <p>• <strong>Email</strong> → customer_email</p>
                <p>• <strong>Claim_Type or Type</strong> → claim_type</p>
                <p>• <strong>Status</strong> → claim_status</p>
                <p>• <strong>Contractor_Info.name</strong> → contractor</p>
                <p>• <strong>Contractor_Email</strong> → contractor_email</p>
                <p>• <strong>Street_Address, City, State, Zip</strong> → property_address</p>
                <p>• <strong>Description or Customer_Facing_Description</strong> → customer_facing_description</p>
                <p>• <strong>Claim_Date or Created_Time</strong> → claim_date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}