import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, blocked } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user
    const users = await base44.asServiceRole.entities.User.filter({ email });
    
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Update block status
    await base44.asServiceRole.entities.User.update(users[0].id, {
      is_blocked: blocked
    });

    return Response.json({ 
      success: true,
      message: blocked ? 'User blocked' : 'User unblocked'
    });

  } catch (error) {
    console.error('Toggle block error:', error);
    return Response.json({ 
      error: error.message || 'Failed to toggle block status' 
    }, { status: 500 });
  }
});