import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate the user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const { customer_email, subject, message_body, file_urls } = await req.json();

    // Validate required fields
    if (!customer_email || !subject || !message_body) {
      return Response.json({ 
        error: 'Missing required fields: customer_email, subject, message_body' 
      }, { status: 400 });
    }

    // Create the message using service role
    const message = await base44.asServiceRole.entities.Message.create({
      customer_email,
      subject,
      message_body,
      file_urls: file_urls || [],
      status: 'unread'
    });

    return Response.json({ success: true, message });
  } catch (error) {
    console.error('Error creating message:', error);
    return Response.json({ 
      error: error.message || 'Failed to create message' 
    }, { status: 500 });
  }
});