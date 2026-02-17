import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { template_name, variables } = await req.json();

    if (!template_name) {
      return Response.json({ error: 'template_name is required' }, { status: 400 });
    }

    // Get the template
    const templates = await base44.asServiceRole.entities.EmailTemplate.filter({ 
      template_name 
    });

    if (templates.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = templates[0];
    let subject = template.subject;
    let body = template.body;

    // Replace variables if provided
    if (variables) {
      Object.keys(variables).forEach(key => {
        const value = variables[key] || '';
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    return Response.json({ 
      subject,
      body
    });

  } catch (error) {
    console.error('Get template error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get template' 
    }, { status: 500 });
  }
});