import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const { module = 'Policies' } = body;

        // Get access token
        const clientId = Deno.env.get('ZOHO_CLIENT_ID');
        const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
        const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            return Response.json({ 
                error: 'Zoho credentials not configured' 
            }, { status: 400 });
        }

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return Response.json({ 
                error: 'Failed to get access token',
                details: tokenData 
            }, { status: 400 });
        }

        const accessToken = tokenData.access_token;

        // Fetch sample record to get available fields
        const response = await fetch(`https://www.zohoapis.com/crm/v2/${module}?per_page=1`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        const zohoData = await response.json();

        if (!zohoData.data || zohoData.data.length === 0) {
            return Response.json({ 
                error: 'No records found in this module',
                details: zohoData 
            }, { status: 400 });
        }

        const sampleRecord = zohoData.data[0];
        const availableFields = Object.keys(sampleRecord);

        return Response.json({ 
            success: true,
            module,
            availableFields,
            sampleRecord
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});