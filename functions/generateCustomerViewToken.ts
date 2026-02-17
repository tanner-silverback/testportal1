import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { customerEmail } = await req.json();
    
    if (!customerEmail) {
      return Response.json({ error: 'Customer email is required' }, { status: 400 });
    }

    // Find the customer account
    const accounts = await base44.asServiceRole.entities.CustomerAccount.filter({ email: customerEmail });
    
    if (accounts.length === 0) {
      return Response.json({ error: 'Customer account not found' }, { status: 404 });
    }

    const account = accounts[0];

    // Generate a temporary view token (valid for 1 hour)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Store the token temporarily (using a simple entity for demo)
    // In production, you might use Redis or similar
    await base44.asServiceRole.entities.CustomerAccount.update(account.id, {
      ...account,
      view_token: token,
      view_token_expires: expiresAt
    });

    return Response.json({ 
      success: true, 
      token,
      customerEmail 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});