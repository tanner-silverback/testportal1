import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('google_oauth_client_secret');
    const appId = Deno.env.get('BASE44_APP_ID');
    const redirectUri = `https://silver-back-home-warranty-portal-66db022e.base44.app/api/apps/${appId}/functions/getGmailRefreshToken`;

    // Step 1: If no code, show authorization URL
    if (!code) {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.send')}&` +
        `access_type=offline&` +
        `prompt=consent`;

      return new Response(`
        <html>
          <body style="font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto;">
            <h1>Gmail OAuth Setup</h1>
            <p>Click the button below to authorize Gmail API access:</p>
            <a href="${authUrl}" style="display: inline-block; padding: 12px 24px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Authorize Gmail Access
            </a>
            <p style="color: #666; font-size: 14px;">You'll be redirected to Google to grant permission, then back here to get your refresh token.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Step 2: Exchange code for refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return Response.json({ error: tokens.error_description || tokens.error }, { status: 400 });
    }

    return new Response(`
      <html>
        <body style="font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto;">
          <h1>✅ Success!</h1>
          <p>Copy this refresh token and save it as the <code>GMAIL_REFRESH_TOKEN</code> secret:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 4px; margin: 20px 0; word-break: break-all; font-family: monospace;">
            ${tokens.refresh_token}
          </div>
          <p style="color: #666;">Once you've saved this as a secret, the contact form will use Gmail API with proper reply-to headers.</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Gmail OAuth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  } 
});