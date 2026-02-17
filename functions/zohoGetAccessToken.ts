import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Helper function to get fresh access token using refresh token
export async function getZohoAccessToken(base44 = null) {
    const clientId = Deno.env.get('ZOHO_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
    let refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

    // If no env var, try to get from user's stored token
    if (!refreshToken && base44) {
        const users = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        if (users.length > 0 && users[0].zoho_refresh_token) {
            refreshToken = users[0].zoho_refresh_token;
        }
    }

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Zoho credentials not configured. Please complete OAuth setup and save refresh token.');
    }

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();

    if (data.access_token) {
        return data.access_token;
    }

    throw new Error(data.error || 'Failed to get access token');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = await getZohoAccessToken();
        return Response.json({ accessToken });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});