import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        
        // Step 2: Handle OAuth callback (no auth required - this is a redirect from Zoho)
        if (code) {
            const clientId = Deno.env.get('ZOHO_CLIENT_ID');
            const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
            const redirectUri = `${url.origin}/api/functions/zohoAuth`;

            const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                    code: code
                })
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.refresh_token) {
                return new Response(`
                    <html>
                        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
                            <h2>✅ Zoho CRM Connected Successfully!</h2>
                            <p>Your refresh token has been generated. Please save this in your app settings:</p>
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all;">
                                <strong>ZOHO_REFRESH_TOKEN:</strong><br/>
                                ${tokenData.refresh_token}
                            </div>
                            <p><strong>Instructions:</strong></p>
                            <ol>
                                <li>Copy the refresh token above</li>
                                <li>Go to your Base44 Dashboard → Settings → Environment Variables</li>
                                <li>Add/Update ZOHO_REFRESH_TOKEN with this value</li>
                                <li>Return to the admin panel and click "Sync Data"</li>
                            </ol>
                            <p><a href="/AdminZoho" style="color: #1e40af;">← Back to Admin Panel</a></p>
                        </body>
                    </html>
                `, {
                    headers: { 'Content-Type': 'text/html' }
                });
            }

            return Response.json({ error: 'Failed to get refresh token', details: tokenData }, { status: 400 });
        }

        // For all other actions, require authentication
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Check request body for action
        let action = url.searchParams.get('action');
        if (!action && req.method === 'POST') {
            const body = await req.json();
            action = body.action;
        }

        // Step 1: Generate authorization URL
        if (action === 'getAuthUrl') {
            const clientId = Deno.env.get('ZOHO_CLIENT_ID');
            
            if (!clientId) {
                return Response.json({ 
                    error: 'ZOHO_CLIENT_ID not set. Please add it in Dashboard → Settings → Environment Variables' 
                }, { status: 400 });
            }
            
            const redirectUri = `${url.origin}/api/functions/zohoAuth`;
            
            const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
                `scope=ZohoCRM.modules.ALL&` +
                `client_id=${clientId}&` +
                `response_type=code&` +
                `access_type=offline&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}`;
            
            return Response.json({ 
                authUrl,
                redirectUri // Return this so user can verify it matches their Zoho config
            });
        }

        return Response.json({ error: 'Missing required parameters' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});