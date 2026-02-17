import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { claim, policy, customerName, customerEmail } = await req.json();

    if (!claim || !customerEmail) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send email to SilverBack team
    const emailBody = `
<h2>Claim Cancellation Request</h2>

<p>A customer has requested to cancel a claim. Please review and follow up within 48 business hours.</p>

<h3>Customer Information:</h3>
<ul>
  <li><strong>Name:</strong> ${customerName || 'N/A'}</li>
  <li><strong>Email:</strong> ${customerEmail}</li>
  ${user.phone ? `<li><strong>Phone:</strong> ${user.phone}</li>` : ''}
</ul>

<h3>Claim Information:</h3>
<ul>
  <li><strong>Claim Number:</strong> ${claim.claim_name}</li>
  ${claim.claim_type ? `<li><strong>Claim Type:</strong> ${claim.claim_type}</li>` : ''}
  ${claim.claim_status ? `<li><strong>Status:</strong> ${claim.claim_status}</li>` : ''}
  ${claim.claim_date ? `<li><strong>Claim Date:</strong> ${claim.claim_date}</li>` : ''}
  ${claim.property_address ? `<li><strong>Property Address:</strong> ${claim.property_address}</li>` : ''}
  ${claim.customer_facing_description ? `<li><strong>Description:</strong> ${claim.customer_facing_description}</li>` : ''}
</ul>

${policy ? `
<h3>Policy Information:</h3>
<ul>
  <li><strong>Policy Number:</strong> ${policy.policy_number || claim.policy_id}</li>
  ${policy.policy_name ? `<li><strong>Plan:</strong> ${policy.policy_name}</li>` : ''}
  ${policy.property_address ? `<li><strong>Property:</strong> ${policy.property_address}</li>` : ''}
</ul>
` : claim.policy_id ? `
<h3>Policy Information:</h3>
<ul>
  <li><strong>Policy Number:</strong> ${claim.policy_id}</li>
</ul>
` : ''}

<p><em>This is an automated email from the SilverBack Home Warranty customer portal.</em></p>
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'SilverBack Customer Portal',
      to: 'info@silverbackhw.com',
      subject: `Claim Cancellation Request - Claim #${claim.claim_name}`,
      body: emailBody
    });

    return Response.json({
      success: true,
      message: 'Cancellation request submitted successfully'
    });
  } catch (error) {
    console.error('Error processing cancellation request:', error);
    return Response.json({
      error: 'Failed to process cancellation request',
      details: error.message
    }, { status: 500 });
  }
});