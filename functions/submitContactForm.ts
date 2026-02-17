import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Simple SMTP client for Gmail
async function sendGmailSMTP({ from, to, replyTo, subject, html }) {
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html
  ].filter(Boolean).join('\r\n');

  const base64Message = btoa(unescape(encodeURIComponent(message)));

  // Use Gmail API via fetch
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      refresh_token: 'YOUR_REFRESH_TOKEN'
    })
  });

  // Fallback to Base44 SendEmail with custom formatting
  throw new Error('Use Base44 SendEmail');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, subject, message, file_urls = [] } = await req.json();

    if (!email || !subject || !message) {
      return Response.json({ 
        error: 'Email, subject and message are required' 
      }, { status: 400 });
    }

    // Store message in inbox database
    const messageRecord = await base44.asServiceRole.entities.Message.create({
      customer_email: user.email,
      subject: subject,
      message_body: message,
      file_urls: file_urls,
      status: 'unread'
    });

    // Build email body for admin
    let emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #334155; border-bottom: 2px solid #334155; padding-bottom: 10px;">
              New Customer Support Request
            </h2>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Customer Name:</strong> ${user.full_name}</p>
              <p style="margin: 5px 0;"><strong>Customer Email:</strong> <a href="mailto:${email}" style="color: #2563eb;">${email}</a></p>
              <p style="margin: 5px 0;"><strong>Account Email:</strong> ${user.email}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="color: #475569;">Message:</h3>
              <p style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
            </div>
    `;

    if (file_urls && file_urls.length > 0) {
      emailBody += `
            <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
              <h3 style="color: #475569; margin-top: 0;">Attachments:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${file_urls.map(url => `<li style="margin: 5px 0;"><a href="${url}" style="color: #2563eb;">${url.split('/').pop()}</a></li>`).join('')}
              </ul>
            </div>
      `;
    }

    emailBody += `
          </div>
        </body>
      </html>
    `;

    // Add prominent reply instruction at the top of admin email
    const adminEmailWithReply = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #3b82f6; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <h3 style="margin: 0 0 8px 0;">📧 REPLY TO THIS EMAIL</h3>
              <p style="margin: 0; font-size: 18px;"><strong>${email}</strong></p>
              <p style="margin: 8px 0 0 0; font-size: 14px;">This is ${user.full_name}'s email address</p>
            </div>
            
            <h2 style="color: #334155; border-bottom: 2px solid #334155; padding-bottom: 10px;">
              New Customer Support Request
            </h2>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Customer Name:</strong> ${user.full_name}</p>
              <p style="margin: 5px 0;"><strong>Customer Email:</strong> <a href="mailto:${email}" style="color: #2563eb; font-size: 16px; font-weight: bold;">${email}</a></p>
              <p style="margin: 5px 0;"><strong>Account Email:</strong> ${user.email}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="color: #475569;">Message:</h3>
              <p style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
            </div>
    `;

    let fullAdminEmail = adminEmailWithReply;
    
    if (file_urls && file_urls.length > 0) {
      fullAdminEmail += `
            <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
              <h3 style="color: #475569; margin-top: 0;">Attachments:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${file_urls.map(url => `<li style="margin: 5px 0;"><a href="${url}" style="color: #2563eb;">${url.split('/').pop()}</a></li>`).join('')}
              </ul>
            </div>
      `;
    }

    fullAdminEmail += `
          </div>
        </body>
      </html>
    `;

    // Send email to admin
    await base44.integrations.Core.SendEmail({
      from_name: `${user.full_name} via SilverBack Portal`,
      to: 'info@silverbackhw.com',
      subject: `🔔 Support Request from ${user.full_name} - REPLY TO: ${email}`,
      body: fullAdminEmail
    });

    // Send confirmation email to customer
    const confirmationBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #334155; border-bottom: 2px solid #334155; padding-bottom: 10px;">
              Message Received - SilverBack Home Warranty
            </h2>
            
            <p>Thank you for contacting us! We've received your message and will get back to you as soon as possible.</p>

            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <div style="margin-top: 10px;">
                <strong>Your Message:</strong>
                <p style="white-space: pre-wrap; margin-top: 5px;">${message.replace(/\n/g, '<br>')}</p>
              </div>
            </div>

            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
              <p style="margin: 0;">
                <strong>We'll respond to you via email at ${email}</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Message Received: ${subject}`,
      body: confirmationBody
    });

    return Response.json({ 
      success: true,
      message: 'Your message has been sent successfully',
      messageId: messageRecord.id
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send message' 
    }, { status: 500 });
  }
});