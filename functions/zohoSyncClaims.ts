import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const { module = 'Claims', limit = 10000, fields = {}, dateField, startDate, endDate, recordId, recordIds } = body;

        // Get access token
        const clientId = Deno.env.get('ZOHO_CLIENT_ID');
        const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
        const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            return Response.json({ 
                error: 'Zoho credentials not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN in environment variables.' 
            }, { status: 400 });
        }

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return Response.json({ 
                error: 'Failed to get access token',
                details: tokenData 
            }, { status: 400 });
        }

        const accessToken = tokenData.access_token;

        let allClaims = [];

        // Handle both single recordId (legacy) and recordIds array
        const idsToSync = recordIds || (recordId ? [recordId] : []);
        
        // If specific record IDs provided, search by claim numbers using search API
        if (idsToSync.length > 0) {
            console.log(`[zohoSyncClaims] Searching for ${idsToSync.length} claim numbers:`, idsToSync);
            
            for (const id of idsToSync) {
                console.log(`[zohoSyncClaims] Searching for claim number: ${id}`);
                
                // Use search API with criteria - try Claim_Number first
                const searchUrl = `https://www.zohoapis.com/crm/v2/${module}/search?criteria=(Claim_Number:equals:${encodeURIComponent(id)})`;
                console.log(`[zohoSyncClaims] Search URL: ${searchUrl}`);
                
                const response = await fetch(searchUrl, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`
                    }
                });

                const zohoData = await response.json();
                console.log('[zohoSyncClaims] Search response:', JSON.stringify(zohoData, null, 2));

                if (zohoData.data && zohoData.data.length > 0) {
                    allClaims = allClaims.concat(zohoData.data);
                    console.log(`[zohoSyncClaims] Found ${zohoData.data.length} claim(s) with Claim_Number ${id}`);
                } else {
                    console.log('[zohoSyncClaims] Claim not found, trying Name field...');
                    
                    // Try searching by Name field as fallback
                    const nameSearchUrl = `https://www.zohoapis.com/crm/v2/${module}/search?criteria=(Name:equals:${encodeURIComponent(id)})`;
                    console.log(`[zohoSyncClaims] Name Search URL: ${nameSearchUrl}`);
                    
                    const nameResponse = await fetch(nameSearchUrl, {
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${accessToken}`
                        }
                    });
                    
                    const nameData = await nameResponse.json();
                    console.log('[zohoSyncClaims] Name search response:', JSON.stringify(nameData, null, 2));
                    
                    if (nameData.data && nameData.data.length > 0) {
                        allClaims = allClaims.concat(nameData.data);
                        console.log(`[zohoSyncClaims] Found ${nameData.data.length} claim(s) by Name`);
                    } else {
                        console.log(`[zohoSyncClaims] Claim ${id} not found in either field`);
                        errors.push({ claim: id, error: 'Not found in Zoho' });
                    }
                }
            }
            
            if (allClaims.length === 0) {
                return Response.json({ 
                    error: `No claims found for the provided numbers`,
                    searched: idsToSync,
                    errors
                }, { status: 404 });
            }
            
            console.log(`[zohoSyncClaims] Total found: ${allClaims.length} claims`);
        }
        } else {
            // Build COQL query for date filtering (more reliable than criteria)
            let coqlWhere = '';
            if (dateField && startDate && endDate) {
                coqlWhere = ` where ${dateField} between '${startDate}' and '${endDate}'`;
            }

            // Fetch all records with pagination
            let page = 1;
            const perPage = 200; // Zoho max per request
            let hasMore = true;

            while (hasMore && allClaims.length < limit) {
                const url = new URL(`https://www.zohoapis.com/crm/v2/${module}`);
                url.searchParams.set('per_page', perPage);
                url.searchParams.set('page', page);
                
                // Use COQL if date filtering, otherwise use regular API with sort
                if (coqlWhere) {
                    // Note: COQL has different endpoint
                    const coqlQuery = `select * from ${module}${coqlWhere} order by Created_Time desc limit ${perPage} offset ${(page - 1) * perPage}`;
                    
                    const coqlResponse = await fetch('https://www.zohoapis.com/crm/v2/coql', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ select_query: coqlQuery })
                    });

                    const coqlData = await coqlResponse.json();

                    if (!coqlData.data || coqlData.data.length === 0) {
                        hasMore = false;
                        break;
                    }

                    allClaims = allClaims.concat(coqlData.data);
                    
                    // Check if there are more records
                    if (!coqlData.info?.more_records) {
                        hasMore = false;
                    }
                } else {
                    url.searchParams.set('sort_by', 'Created_Time');
                    url.searchParams.set('sort_order', 'desc');

                    const response = await fetch(url.toString(), {
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${accessToken}`
                        }
                    });

                    const zohoData = await response.json();

                    if (!zohoData.data || zohoData.data.length === 0) {
                        hasMore = false;
                        break;
                    }

                    allClaims = allClaims.concat(zohoData.data);
                    
                    // Check if there are more pages
                    if (!zohoData.info?.more_records) {
                        hasMore = false;
                    }
                }
                
                page++;
            }

            if (allClaims.length === 0) {
                return Response.json({ 
                    error: 'No claims found',
                    details: 'No records matched the criteria'
                }, { status: 400 });
            }
        }

        const claims = allClaims.slice(0, limit);
        let created = 0;
        let updated = 0;
        const errors = [];
        const sampleFields = claims.length > 0 ? Object.keys(claims[0]) : [];
        const samplePolicyNameField = claims.length > 0 ? claims[0].Policy_Name : null;

        // Load custom field mappings
        const customMappings = await base44.asServiceRole.entities.ZohoFieldMapping.filter({ 
            module_type: 'Claim',
            is_active: true 
        });
        
        // Create mapping lookup
        const fieldMap = {};
        customMappings.forEach(m => {
            fieldMap[m.app_field] = m.zoho_field;
        });

        // Helper function to get nested field value
        const getNestedValue = (obj, path) => {
            return path.split('.').reduce((curr, key) => curr?.[key], obj);
        };

        for (const zohoClaim of claims) {
            try {
                // Default policy ID extraction logic
                let defaultPolicyId = null;
                const policyReference = zohoClaim.Policy_Name;
                if (policyReference) {
                    defaultPolicyId = policyReference.Policy_Number || policyReference.name || policyReference;
                }

                // Use custom mappings if available, otherwise use defaults
                const claimData = {
                    claim_name: fieldMap.claim_name ? 
                        getNestedValue(zohoClaim, fieldMap.claim_name) : 
                        (zohoClaim.Claim_Number || zohoClaim.Name),
                    policy_id: fieldMap.policy_id ? 
                        getNestedValue(zohoClaim, fieldMap.policy_id) : 
                        defaultPolicyId,
                    customer_email: fieldMap.customer_email ? 
                        getNestedValue(zohoClaim, fieldMap.customer_email) : 
                        zohoClaim.Email,
                    claim_type: fieldMap.claim_type ? 
                        getNestedValue(zohoClaim, fieldMap.claim_type) : 
                        (zohoClaim.Claim_Type || zohoClaim.Type),
                    claim_status: fieldMap.claim_status ? 
                        getNestedValue(zohoClaim, fieldMap.claim_status) : 
                        (zohoClaim.Status || 'Pending'),
                    contractor: fieldMap.contractor ? 
                        getNestedValue(zohoClaim, fieldMap.contractor) : 
                        zohoClaim.Contractor_Info?.name,
                    contractor_email: fieldMap.contractor_email ? 
                        getNestedValue(zohoClaim, fieldMap.contractor_email) : 
                        zohoClaim.Contractor_Email,
                    property_address: fieldMap.property_address ? 
                        getNestedValue(zohoClaim, fieldMap.property_address) : 
                        [zohoClaim.Street_Address || zohoClaim.Street || zohoClaim.Address, zohoClaim.City, zohoClaim.State, zohoClaim.Zip || zohoClaim.Zip_Code]
                            .filter(Boolean).join(', ') || null,
                    customer_facing_description: fieldMap.customer_facing_description ? 
                        getNestedValue(zohoClaim, fieldMap.customer_facing_description) : 
                        (zohoClaim.Description || zohoClaim.Customer_Facing_Description),
                    claim_date: fieldMap.claim_date ? 
                        getNestedValue(zohoClaim, fieldMap.claim_date) : 
                        (zohoClaim.Claim_Date || zohoClaim.Created_Time),
                    zoho_id: zohoClaim.id
                };

                const existing = await base44.asServiceRole.entities.Claim.filter({ 
                    zoho_id: zohoClaim.id 
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.Claim.update(existing[0].id, claimData);
                    updated++;
                } else {
                    await base44.asServiceRole.entities.Claim.create(claimData);
                    created++;
                }
            } catch (err) {
                errors.push({ claim: zohoClaim.Name || zohoClaim.id, error: err.message });
            }
        }

        return Response.json({ 
            success: true,
            created,
            updated,
            total: claims.length,
            errors: errors.length > 0 ? errors : undefined,
            debugInfo: {
                availableFields: sampleFields,
                samplePolicyNameField: samplePolicyNameField,
                sampleRecord: claims.length > 0 ? claims[0] : null
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});