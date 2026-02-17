import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId, subject, messageBody, fileUrls, category, customerEmail, customerName } = await req.json();

    if (!messageBody) {
      return Response.json({ error: 'Message body is required' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin';
    const finalCustomerEmail = isAdmin ? customerEmail : user.email;
    const finalCustomerName = isAdmin ? customerName : user.full_name;

    // Validation: Ensure we have a valid customer email
    if (!finalCustomerEmail || finalCustomerEmail.includes('example.com')) {
      console.error('Invalid customer email:', finalCustomerEmail);
      return Response.json({ 
        error: 'Invalid customer email. Please ensure customer information is provided.' 
      }, { status: 400 });
    }

    // Generate thread ID if new conversation
    const finalThreadId = threadId || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create message
    const message = await base44.asServiceRole.entities.Message.create({
      thread_id: finalThreadId,
      customer_email: finalCustomerEmail,
      customer_name: finalCustomerName,
      subject: subject || 'No Subject',
      message_body: messageBody,
      category: category || 'Other',
      file_urls: fileUrls || [],
      sent_by: isAdmin ? 'admin' : 'customer'
    });

    const appUrl = Deno.env.get('BASE_URL') || 'https://silverback-hw.base44.app';
    const inboxLink = `${appUrl}/Inbox?thread=${finalThreadId}`;

    // Helper function to send email via Gmail API
    const sendGmailAPI = async (to, subject, htmlBody) => {
      const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = Deno.env.get('google_oauth_client_secret');
      const fromEmail = Deno.env.get('GMAIL_USER');

      // Get access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const { access_token } = await tokenResponse.json();

      // Create email message
      const emailLines = [
        `From: SilverBack Home Warranty <${fromEmail}>`,
        `Reply-To: SilverBack Home Warranty <info@silverbackhw.com>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody
      ];
      const email = emailLines.join('\r\n');
      const encodedEmail = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedEmail })
      });

      if (!sendResponse.ok) {
        throw new Error(`Gmail API error: ${await sendResponse.text()}`);
      }

      return await sendResponse.json();
    };

    console.log('=== EMAIL NOTIFICATION START ===');
    console.log('isAdmin:', isAdmin);
    console.log('finalCustomerEmail:', finalCustomerEmail);
    console.log('finalCustomerName:', finalCustomerName);
    console.log('user.email:', user.email);

    // Send email notification based on who sent the message
    if (isAdmin) {
      console.log('ADMIN FLOW: Notifying customer');
      // Admin sent message -> notify customer
      let emailSubject = `New Message from SilverBack Home Warranty`;
      let customerEmailBody = `
    <h2>New Message from SilverBack Home Warranty</h2>

    <p>Hello ${finalCustomerName},</p>

    <p>You have received a new message in your customer portal.</p>

    <p><a href="${inboxLink}" style="display:inline-block;background-color:#0f172a;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">View Message in Portal</a></p>

    <p>If you need immediate assistance, please call us at (801)686-8927.</p>

    <p>Best regards,<br>SilverBack Home Warranty Team</p>
      `.trim();

      // Try to get custom template
      try {
        const templateResponse = await base44.asServiceRole.functions.invoke('getEmailTemplate', {
          template_name: 'admin_to_customer_message',
          variables: { customer_name: finalCustomerName, inbox_link: inboxLink, subject: subject || 'No Subject' }
        });
        if (templateResponse.data?.subject && templateResponse.data?.body) {
          emailSubject = templateResponse.data.subject;
          customerEmailBody = templateResponse.data.body;
        }
      } catch (templateError) {
        console.log('Using default admin to customer template');
      }

      try {
        console.log('Sending email TO:', finalCustomerEmail);
        const result = await sendGmailAPI(
          finalCustomerEmail,
          emailSubject,
          customerEmailBody
        );
        console.log('✓ Customer notification email sent successfully:', result);
      } catch (emailError) {
        console.error('✗ Failed to send customer notification email:', emailError);
        console.error('Error stack:', emailError.stack);
      }
    } else {
      console.log('CUSTOMER FLOW: Sending confirmation and notifying admin');
      // Customer sent message -> send confirmation to customer ONLY for new messages (not replies)
      if (!threadId) {
        console.log('New message - sending confirmation TO customer:', finalCustomerEmail);
        let confirmSubject = `Message Received: ${subject || 'No Subject'}`;
        let customerConfirmationBody = `
    <h2>Message Submitted Successfully</h2>

    <p>Thank you for contacting SilverBack Home Warranty. We have received your message and will respond as soon as possible.</p>

    <p><strong>Subject:</strong> ${subject || 'No Subject'}</p>
    ${category ? `<p><strong>Regarding:</strong> ${category}</p>` : ''}

    <p><strong>Your Message:</strong></p>
    <p>${messageBody.replace(/\n/g, '<br>')}</p>

    ${fileUrls && fileUrls.length > 0 ? `
    <p><strong>Attachments:</strong> ${fileUrls.length} file(s)</p>
    ` : ''}

    <p><a href="${inboxLink}" style="display:inline-block;background-color:#0f172a;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">View Message in Portal</a></p>

    <p><em>If you need immediate assistance, please call us at (801)686-8927.</em></p>
      `.trim();

        // Try to get custom template
        try {
          const templateResponse = await base44.asServiceRole.functions.invoke('getEmailTemplate', {
            template_name: 'customer_message_confirmation',
            variables: { customer_name: finalCustomerName, message_body: messageBody, subject: subject || 'No Subject' }
          });
          if (templateResponse.data?.subject && templateResponse.data?.body) {
            confirmSubject = templateResponse.data.subject;
            customerConfirmationBody = templateResponse.data.body;
          }
        } catch (templateError) {
          console.log('Using default confirmation template');
        }

        try {
          const result = await sendGmailAPI(
            finalCustomerEmail,
            confirmSubject,
            customerConfirmationBody
          );
          console.log('✓ Customer confirmation email sent successfully');
        } catch (emailError) {
          console.error('✗ Failed to send customer confirmation:', emailError);
        }
      } else {
        console.log('Reply in thread - skipping customer confirmation');
      }

      // Notify admin
      console.log('Sending admin notification TO: info@silverbackhw.com');
      try {
        let adminSubject = `Customer Message: ${subject || 'No Subject'} - ${finalCustomerName}`;
        let adminEmailBody = `
    <h2>New Customer Message</h2>

    <p><strong>From:</strong> ${finalCustomerName} (${finalCustomerEmail})</p>
    <p><strong>Subject:</strong> ${subject || 'No Subject'}</p>
    ${category ? `<p><strong>Regarding:</strong> ${category}</p>` : ''}

    <p><strong>Message:</strong></p>
    <p>${messageBody.replace(/\n/g, '<br>')}</p>

    ${fileUrls && fileUrls.length > 0 ? `
    <p><strong>Attachments:</strong></p>
    <ul>
    ${fileUrls.map(url => `<li><a href="${url}">${url.split('/').pop()}</a></li>`).join('\n')}
    </ul>
    ` : ''}

    <p><a href="${inboxLink}" style="display:inline-block;background-color:#0f172a;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:10px;">View Message in Portal</a></p>

    <p><em>This is an automated notification from the customer portal.</em></p>
      `.trim();

        // Try to get custom template
        try {
          const templateResponse = await base44.asServiceRole.functions.invoke('getEmailTemplate', {
            template_name: 'admin_new_message_notification',
            variables: { 
              customer_name: finalCustomerName, 
              customer_email: finalCustomerEmail,
              message_body: messageBody, 
              subject: subject || 'No Subject' 
            }
          });
          if (templateResponse.data?.subject && templateResponse.data?.body) {
            adminSubject = templateResponse.data.subject;
            adminEmailBody = templateResponse.data.body;
          }
        } catch (templateError) {
          console.log('Using default admin notification template');
        }

        const result = await sendGmailAPI(
          'info@silverbackhw.com',
          adminSubject,
          adminEmailBody
        );
        console.log('✓ Admin notification email sent successfully');
      } catch (emailError) {
        console.error('✗ Failed to send admin notification:', emailError);
      }
    }

    console.log('=== EMAIL NOTIFICATION END ===');

    return Response.json({
      success: true,
      message: message,
      threadId: finalThreadId
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return Response.json({
      error: 'Failed to send message',
      details: error.message
    }, { status: 500 });
  }
});