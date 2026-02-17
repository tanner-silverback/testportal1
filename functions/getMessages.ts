import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized', messages: [] }, { status: 200 });
    }

    const isAdmin = user.role === 'admin';

    // Fetch messages
    let messages = [];
    try {
      if (isAdmin) {
        messages = await base44.asServiceRole.entities.Message.filter({}, '-created_date');
      } else {
        messages = await base44.asServiceRole.entities.Message.filter(
          { customer_email: user.email },
          '-created_date'
        );
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      messages = [];
    }

    return Response.json({ success: true, messages: messages || [] });
  } catch (error) {
    console.error('Error in getMessages:', error);
    return Response.json({
      success: false,
      messages: [],
      error: error.message
    }, { status: 200 });
  }
});