import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse webhook payload from Zoho
        const payload = await req.json();
        
        // Zoho webhook sends updates in this format
        const module = payload.module;
        const operation = payload.operation;
        const data = payload.data;

        if (!data || !data.length) {
            return Response.json({ message: 'No data received' });
        }

        const record = data[0];

        // Handle Policy updates
        if (module === 'Policies') {
            const policyData = {
                policy_number: record.Policy_Number || record.Name,
                policy_name: record.Policy_Name || record.Plan_Name,
                details_of_coverage: record.Coverage_Details || record.Details_of_Coverage,
                policy_status: record.Status || 'Active',
                effective_date: record.Effective_Date,
                expiration_date: record.Expiration_Date,
                customer_name: record.Customer_Name,
                customer_email: record.Customer_Email || record.Email,
                property_address: record.Property_Address || record.Address,
                zoho_id: record.id
            };

            // Check if exists
            const existing = await base44.asServiceRole.entities.Policy.filter({ 
                zoho_id: record.id 
            });

            if (operation === 'delete' && existing.length > 0) {
                await base44.asServiceRole.entities.Policy.delete(existing[0].id);
            } else if (existing.length > 0) {
                await base44.asServiceRole.entities.Policy.update(existing[0].id, policyData);
            } else {
                await base44.asServiceRole.entities.Policy.create(policyData);
            }
        }

        // Handle Claim updates
        if (module === 'Claims') {
            const claimData = {
                claim_name: record.Claim_Number || record.Name,
                policy_id: record.Policy_ID,
                customer_email: record.Customer_Email || record.Email,
                claim_type: record.Claim_Type || record.Type,
                claim_status: record.Status || 'Pending',
                contractor: record.Contractor || record.Contractor_Name,
                contractor_email: record.Contractor_Email,
                customer_facing_description: record.Description || record.Customer_Facing_Description,
                claim_date: record.Claim_Date || record.Created_Time,
                zoho_id: record.id
            };

            // Check if exists
            const existing = await base44.asServiceRole.entities.Claim.filter({ 
                zoho_id: record.id 
            });

            if (operation === 'delete' && existing.length > 0) {
                await base44.asServiceRole.entities.Claim.delete(existing[0].id);
            } else if (existing.length > 0) {
                await base44.asServiceRole.entities.Claim.update(existing[0].id, claimData);
            } else {
                await base44.asServiceRole.entities.Claim.create(claimData);
            }
        }

        return Response.json({ success: true, message: 'Webhook processed' });

    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});