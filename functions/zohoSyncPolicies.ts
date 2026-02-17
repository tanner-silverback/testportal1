import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        console.log('[zohoSyncPolicies] Starting sync...');
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            console.log('[zohoSyncPolicies] Unauthorized user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const { module = 'Policies', limit = 10000, fields = {}, dateField, startDate, endDate, recordId, recordIds } = body;
        
        console.log('[zohoSyncPolicies] Config:', { module, limit, dateField, startDate, endDate, recordId, recordIds });
        
        let errors = [];

        // Get access token
        const clientId = Deno.env.get('ZOHO_CLIENT_ID');
        const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
        const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            console.log('[zohoSyncPolicies] Missing credentials:', { 
                hasClientId: !!clientId, 
                hasClientSecret: !!clientSecret, 
                hasRefreshToken: !!refreshToken 
            });
            return Response.json({ 
                error: 'Zoho credentials not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN in environment variables.' 
            }, { status: 400 });
        }
        
        console.log('[zohoSyncPolicies] Credentials found, getting access token...');

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
            console.log('[zohoSyncPolicies] Failed to get access token:', tokenData);
            return Response.json({ 
                error: 'Failed to get access token',
                details: tokenData 
            }, { status: 400 });
        }

        const accessToken = tokenData.access_token;
        console.log('[zohoSyncPolicies] Access token obtained');

        let allPolicies = [];

        // Handle both single recordId (legacy) and recordIds array
        const idsToSync = recordIds || (recordId ? [recordId] : []);
        
        // If specific record IDs provided, search by policy numbers using search API
        if (idsToSync.length > 0) {
            console.log(`[zohoSyncPolicies] Searching for ${idsToSync.length} policy numbers:`, idsToSync);
            
            for (const id of idsToSync) {
                console.log(`[zohoSyncPolicies] Searching for policy number: ${id}`);
                
                // Use search API with criteria
                const searchUrl = `https://www.zohoapis.com/crm/v2/${module}/search?criteria=(Policy_Number:equals:${encodeURIComponent(id)})`;
                console.log(`[zohoSyncPolicies] Search URL: ${searchUrl}`);
                
                const response = await fetch(searchUrl, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`
                    }
                });

                const zohoData = await response.json();
                console.log('[zohoSyncPolicies] Search response:', JSON.stringify(zohoData, null, 2));

                if (zohoData.data && zohoData.data.length > 0) {
                    allPolicies = allPolicies.concat(zohoData.data);
                    console.log(`[zohoSyncPolicies] Found ${zohoData.data.length} policy/policies with number ${id}`);
                } else {
                    console.log('[zohoSyncPolicies] Policy not found, trying Name field...');
                    
                    // Try searching by Name field as fallback
                    const nameSearchUrl = `https://www.zohoapis.com/crm/v2/${module}/search?criteria=(Name:equals:${encodeURIComponent(id)})`;
                    console.log(`[zohoSyncPolicies] Name Search URL: ${nameSearchUrl}`);
                    
                    const nameResponse = await fetch(nameSearchUrl, {
                        headers: {
                            'Authorization': `Zoho-oauthtoken ${accessToken}`
                        }
                    });
                    
                    const nameData = await nameResponse.json();
                    console.log('[zohoSyncPolicies] Name search response:', JSON.stringify(nameData, null, 2));
                    
                    if (nameData.data && nameData.data.length > 0) {
                        allPolicies = allPolicies.concat(nameData.data);
                        console.log(`[zohoSyncPolicies] Found ${nameData.data.length} policy/policies by Name`);
                    } else {
                        console.log(`[zohoSyncPolicies] Policy ${id} not found in either field`);
                        errors.push({ policy: id, error: 'Not found in Zoho' });
                    }
                }
            }
            
            if (allPolicies.length === 0) {
                return Response.json({ 
                    error: `No policies found for the provided numbers`,
                    searched: idsToSync,
                    errors
                }, { status: 404 });
            }
            
            console.log(`[zohoSyncPolicies] Total found: ${allPolicies.length} policies`);
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

            while (hasMore && allPolicies.length < limit) {
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

                    allPolicies = allPolicies.concat(coqlData.data);
                    
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

                    allPolicies = allPolicies.concat(zohoData.data);
                    
                    // Check if there are more pages
                    if (!zohoData.info?.more_records) {
                        hasMore = false;
                    }
                }
                
                page++;
            }

            if (allPolicies.length === 0) {
                console.log('[zohoSyncPolicies] No policies found with given criteria');
                return Response.json({ 
                    error: 'No policies found',
                    details: 'No records matched the criteria'
                }, { status: 400 });
            }
            
            console.log(`[zohoSyncPolicies] Found ${allPolicies.length} policies`);
        }

        const policies = allPolicies.slice(0, limit);
        console.log(`[zohoSyncPolicies] Processing ${policies.length} policies (limit: ${limit})`);
        
        let created = 0;
        let updated = 0;
        const sampleFields = policies.length > 0 ? Object.keys(policies[0]) : [];
        
        console.log('[zohoSyncPolicies] Sample fields:', sampleFields.slice(0, 10));

        // Load custom field mappings
        const customMappings = await base44.asServiceRole.entities.ZohoFieldMapping.filter({ 
            module_type: 'Policy',
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

        // Load claim field mappings
        const claimMappings = await base44.asServiceRole.entities.ZohoFieldMapping.filter({ 
            module_type: 'Claim',
            is_active: true 
        });
        
        const claimFieldMap = {};
        claimMappings.forEach(m => {
            claimFieldMap[m.app_field] = m.zoho_field;
        });

        let claimsCreated = 0;
        let claimsUpdated = 0;

        for (const zohoPolicy of policies) {
            try {
                // Use custom mappings if available, otherwise use defaults
                const policyData = {
                    policy_id: fieldMap.policy_id ? 
                        getNestedValue(zohoPolicy, fieldMap.policy_id) : 
                        zohoPolicy.Name,
                    policy_number: fieldMap.policy_number ? 
                        getNestedValue(zohoPolicy, fieldMap.policy_number) : 
                        zohoPolicy.Policy_Number,
                    policy_name: fieldMap.policy_name ? 
                        getNestedValue(zohoPolicy, fieldMap.policy_name) : 
                        zohoPolicy.Plan_Name,
                    add_ons: fieldMap.add_ons ? 
                        getNestedValue(zohoPolicy, fieldMap.add_ons) : 
                        (Array.isArray(zohoPolicy.Options) ? zohoPolicy.Options : []),
                    policy_status: fieldMap.policy_status ? 
                        getNestedValue(zohoPolicy, fieldMap.policy_status) : 
                        (zohoPolicy.Status || 'Active'),
                    effective_date: fieldMap.effective_date ? 
                        getNestedValue(zohoPolicy, fieldMap.effective_date) : 
                        zohoPolicy.Effective_Date,
                    expiration_date: fieldMap.expiration_date ? 
                        getNestedValue(zohoPolicy, fieldMap.expiration_date) : 
                        zohoPolicy.Expiration_Date,
                    customer_name: fieldMap.customer_name ? 
                        getNestedValue(zohoPolicy, fieldMap.customer_name) : 
                        zohoPolicy.Customer?.name,
                    customer_email: fieldMap.customer_email ? 
                        getNestedValue(zohoPolicy, fieldMap.customer_email) : 
                        zohoPolicy.Email,
                    property_address: fieldMap.property_address ? 
                        getNestedValue(zohoPolicy, fieldMap.property_address) : 
                        [zohoPolicy.Address_1, zohoPolicy.Address_2, zohoPolicy.City, zohoPolicy.State, zohoPolicy.Zip]
                            .filter(Boolean).join(', ') || null,
                    buyer_agent_email: zohoPolicy.Buyer_Agent?.email || null,
                    listing_agent_email: zohoPolicy.Listing_Agent?.email || null,
                    title_escrow_email: zohoPolicy.Title_Escrow?.email || null,
                    zoho_id: zohoPolicy.id
                };

                // Get RE Pro IDs from the policy record - handle both object and array
                let reProIds = [];
                console.log(`[zohoSyncPolicies] Extracting RE Pro IDs for policy ${zohoPolicy.Policy_Number}`);
                console.log(`[zohoSyncPolicies] Re_Pros field:`, JSON.stringify(zohoPolicy.Re_Pros));
                
                if (zohoPolicy.Re_Pros) {
                    if (Array.isArray(zohoPolicy.Re_Pros)) {
                        reProIds = zohoPolicy.Re_Pros.map(rp => rp.id);
                        console.log(`[zohoSyncPolicies] ✓ Extracted from array:`, reProIds);
                    } else if (zohoPolicy.Re_Pros.id) {
                        reProIds = [zohoPolicy.Re_Pros.id];
                        console.log(`[zohoSyncPolicies] ✓ Extracted from object:`, reProIds);
                    }
                } else if (zohoPolicy.RE_Pros) {
                    if (Array.isArray(zohoPolicy.RE_Pros)) {
                        reProIds = zohoPolicy.RE_Pros.map(rp => rp.id);
                        console.log(`[zohoSyncPolicies] ✓ Extracted from RE_Pros array:`, reProIds);
                    } else if (zohoPolicy.RE_Pros.id) {
                        reProIds = [zohoPolicy.RE_Pros.id];
                        console.log(`[zohoSyncPolicies] ✓ Extracted from RE_Pros object:`, reProIds);
                    }
                } else if (zohoPolicy.Agent && zohoPolicy.Agent.id) {
                    reProIds = [zohoPolicy.Agent.id];
                    console.log(`[zohoSyncPolicies] ✓ Extracted from Agent:`, reProIds);
                }
                policyData.re_pro_ids = reProIds;
                console.log(`[zohoSyncPolicies] Final re_pro_ids to save:`, reProIds);

                const existing = await base44.asServiceRole.entities.Policy.filter({ 
                    zoho_id: zohoPolicy.id 
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.Policy.update(existing[0].id, policyData);
                    updated++;
                    console.log(`[zohoSyncPolicies] Updated policy: ${policyData.policy_number || policyData.policy_id}`);
                } else {
                    await base44.asServiceRole.entities.Policy.create(policyData);
                    created++;
                    console.log(`[zohoSyncPolicies] Created policy: ${policyData.policy_number || policyData.policy_id}`);
                }

                // Fetch and sync related claims from Claim_Info
                console.log(`[zohoSyncPolicies] Fetching related claims for policy ${zohoPolicy.id}`);
                const relatedUrl = `https://www.zohoapis.com/crm/v2/Policies/${zohoPolicy.id}/Claim_Info`;
                
                const relatedResponse = await fetch(relatedUrl, {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${accessToken}`
                    }
                });

                let relatedData = null;
                if (relatedResponse.ok) {
                    const responseText = await relatedResponse.text();
                    if (responseText) {
                        try {
                            relatedData = JSON.parse(responseText);
                        } catch (jsonErr) {
                            console.log(`[zohoSyncPolicies] JSON parse error for claims: ${jsonErr.message}`);
                            relatedData = {};
                        }
                    } else {
                        relatedData = {};
                    }
                } else {
                    console.log(`[zohoSyncPolicies] Claims fetch failed: ${relatedResponse.status}`);
                    relatedData = {};
                }
                
                if (relatedData && relatedData.data && relatedData.data.length > 0) {
                    console.log(`[zohoSyncPolicies] Found ${relatedData.data.length} related claims for policy ${policyData.policy_number}`);
                    
                    for (const zohoClaim of relatedData.data) {
                        try {
                            const claimData = {
                                claim_name: claimFieldMap.claim_name ? 
                                    getNestedValue(zohoClaim, claimFieldMap.claim_name) : 
                                    (zohoClaim.Claim_Number || zohoClaim.Name),
                                policy_id: policyData.policy_number,
                                customer_email: policyData.customer_email,
                                customer_phone: claimFieldMap.customer_phone ? 
                                    getNestedValue(zohoClaim, claimFieldMap.customer_phone) : 
                                    zohoClaim.Phone,
                                claim_type: claimFieldMap.claim_type ? 
                                    getNestedValue(zohoClaim, claimFieldMap.claim_type) : 
                                    zohoClaim.System,
                                claim_status: claimFieldMap.claim_status ? 
                                    getNestedValue(zohoClaim, claimFieldMap.claim_status) : 
                                    (zohoClaim.Stage || zohoClaim.Status || 'Pending'),
                                contractor: claimFieldMap.contractor ? 
                                    getNestedValue(zohoClaim, claimFieldMap.contractor) : 
                                    zohoClaim.Contractor?.name,
                                contractor_email: claimFieldMap.contractor_email ? 
                                    getNestedValue(zohoClaim, claimFieldMap.contractor_email) : 
                                    zohoClaim.Contractor_Email,
                                property_address: policyData.property_address,
                                customer_facing_description: claimFieldMap.customer_facing_description ? 
                                   getNestedValue(zohoClaim, claimFieldMap.customer_facing_description) : 
                                   zohoClaim.Issue_Description,
                                claim_date: claimFieldMap.claim_date ? 
                                   getNestedValue(zohoClaim, claimFieldMap.claim_date) : 
                                   (zohoClaim.Created_Time || zohoClaim.Claim_Date),
                                buyer_agent_email: zohoClaim.Buyer_Agent?.email || policyData.buyer_agent_email,
                                zoho_id: zohoClaim.id
                                };

                            const existingClaim = await base44.asServiceRole.entities.Claim.filter({ 
                                zoho_id: zohoClaim.id 
                            });

                            if (existingClaim.length > 0) {
                                await base44.asServiceRole.entities.Claim.update(existingClaim[0].id, claimData);
                                claimsUpdated++;
                                console.log(`[zohoSyncPolicies] Updated claim: ${claimData.claim_name}`);
                            } else {
                                await base44.asServiceRole.entities.Claim.create(claimData);
                                claimsCreated++;
                                console.log(`[zohoSyncPolicies] Created claim: ${claimData.claim_name}`);
                            }
                        } catch (claimErr) {
                            console.log(`[zohoSyncPolicies] Error processing claim ${zohoClaim.Name || zohoClaim.id}:`, claimErr.message);
                            errors.push({ claim: zohoClaim.Name || zohoClaim.id, error: claimErr.message });
                        }
                    }
                } else {
                    console.log(`[zohoSyncPolicies] No related claims found for policy ${policyData.policy_number}`);
                }
            } catch (err) {
                console.log(`[zohoSyncPolicies] Error processing policy ${zohoPolicy.Name || zohoPolicy.id}:`, err.message);
                errors.push({ policy: zohoPolicy.Name || zohoPolicy.id, error: err.message });
            }
        }
        
        console.log(`[zohoSyncPolicies] Sync complete: ${created} policies created, ${updated} policies updated, ${claimsCreated} claims created, ${claimsUpdated} claims updated, ${errors.length} errors`);

        return Response.json({ 
          success: true,
          policies: { created, updated },
          claims: { created: claimsCreated, updated: claimsUpdated },
          total: policies.length,
          errors: errors.length > 0 ? errors : undefined,
          debugInfo: {
              availableFields: sampleFields,
              sampleRecord: policies.length > 0 ? policies[0] : null
          }
        });

    } catch (error) {
        console.log('[zohoSyncPolicies] Fatal error:', error.message, error.stack);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});