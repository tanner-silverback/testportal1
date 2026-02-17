import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Invite user which sends password reset link
    await base44.users.inviteUser(email, 'user');

    return Response.json({ 
      success: true,
      message: 'Password reset link sent'
    });

  } catch (error) {
    console.error('Update password error:', error);
    return Response.json({ 
      error: error.message || 'Failed to reset password' 
    }, { status: 500 });
  }
});