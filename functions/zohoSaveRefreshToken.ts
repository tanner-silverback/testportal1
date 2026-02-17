import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { refreshToken } = await req.json();

        if (!refreshToken) {
            return Response.json({ error: 'Refresh token is required' }, { status: 400 });
        }

        // Save to user metadata (you can also use a database entity if preferred)
        await base44.asServiceRole.entities.User.update(user.id, {
            zoho_refresh_token: refreshToken
        });

        return Response.json({ success: true, message: 'Refresh token saved successfully' });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});