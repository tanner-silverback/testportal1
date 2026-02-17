import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        console.log('[zohoSyncREPros] Starting sync...');
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            console.log('[zohoSyncREPros] Unauthorized user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const { module = 'RE_Pros', limit = 10000, recordIds } = body;
        
        console.log('[zohoSyncREPros] Config:', { module, limit, recordIds });

        // Get access token
        const clientId = Deno.env.get('ZOHO_CLIENT_ID');
        const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
        const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            console.log('[zohoSyncREPros] Missing credentials');
            return Response.json({ 
                error: 'Zoho credentials not configured.' 
            }, { status: 400 });
        }
        
        console.log('[zohoSyncREPros] Getting access token...');

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
            console.log('[zohoSyncREPros] Failed to get access token:', tokenData);
            return Response.json({ 
                error: 'Failed to get access token',
                details: tokenData 
            }, { status: 400 });
        }

        const accessToken = tokenData.access_token;
        console.log('[zohoSyncREPros] Access token obtained');

        let allREPros = [];
        const errors = [];

        if (recordIds && recordIds.length > 0) {
            console.log(`[zohoSyncREPros] Searching for ${recordIds.length} RE Pro IDs`);
            
            for (const id of recordIds) {
                console.log(`[zohoSyncREPros] Searching for: ${id}`);
                
                // Try email search first
                const emailSearchUrl = `https://www.zohoapis.com/crm/v2/${module}/search?criteria=(Email:equals:${encodeURIComponent(id)})`;
                
                const emailResponse = await fetch(emailSearchUrl, {
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });

                let emailData = null;
                if (emailResponse.ok) {
                    const responseText = await emailResponse.text();
                    if (responseText) {
                        try {
                            emailData = JSON.parse(responseText);
                        } catch (jsonErr) {
                            console.log(`[zohoSyncREPros] JSON parse error: ${jsonErr.message}`);
                            emailData = {};
                        }
                    } else {
                        emailData = {};
                    }
                } else {
                    console.log(`[zohoSyncREPros] Email search failed: ${emailResponse.status}`);
                    emailData = {};
                }

                if (emailData.data && emailData.data.length > 0) {
                    allREPros = allREPros.concat(emailData.data);
                    console.log(`[zohoSyncREPros] Found by email: ${id}`);
                } else {
                    console.log(`[zohoSyncREPros] Not found by email, trying ID search...`);
                    
                    // Try direct ID lookup
                    try {
                        const idResponse = await fetch(`https://www.zohoapis.com/crm/v2/${module}/${id}`, {
                            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                        });
                        
                        let idData = null;
                        if (idResponse.ok) {
                            const responseText = await idResponse.text();
                            if (responseText) {
                                try {
                                    idData = JSON.parse(responseText);
                                } catch (jsonErr) {
                                    console.log(`[zohoSyncREPros] ID JSON parse error: ${jsonErr.message}`);
                                }
                            }
                        }
                        
                        if (idData && idData.data && idData.data.length > 0) {
                            allREPros = allREPros.concat(idData.data);
                            console.log(`[zohoSyncREPros] Found by ID: ${id}`);
                        } else {
                            console.log(`[zohoSyncREPros] Not found by ID either`);
                            errors.push({ id, error: 'Not found in Zoho' });
                        }
                    } catch (idErr) {
                        console.log(`[zohoSyncREPros] ID lookup failed: ${idErr.message}`);
                        errors.push({ id, error: 'Not found in Zoho' });
                    }
                }
            }
        } else {
            // Fetch all records
            let page = 1;
            const perPage = 200;
            let hasMore = true;

            while (hasMore && allREPros.length < limit) {
                const url = new URL(`https://www.zohoapis.com/crm/v2/${module}`);
                url.searchParams.set('per_page', perPage);
                url.searchParams.set('page', page);
                url.searchParams.set('sort_by', 'Created_Time');
                url.searchParams.set('sort_order', 'desc');

                const response = await fetch(url.toString(), {
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });

                let zohoData = null;
                if (response.ok) {
                    const responseText = await response.text();
                    if (responseText) {
                        try {
                            zohoData = JSON.parse(responseText);
                        } catch (jsonErr) {
                            console.log(`[zohoSyncREPros] JSON parse error: ${jsonErr.message}`);
                            break;
                        }
                    } else {
                        break;
                    }
                } else {
                    console.log(`[zohoSyncREPros] Fetch failed: ${response.status}`);
                    break;
                }

                if (!zohoData.data || zohoData.data.length === 0) {
                    hasMore = false;
                    break;
                }

                allREPros = allREPros.concat(zohoData.data);
                
                if (!zohoData.info?.more_records) {
                    hasMore = false;
                }
                
                page++;
            }
        }

        if (allREPros.length === 0) {
            console.log('[zohoSyncREPros] No RE Pros found');
            return Response.json({ 
                error: 'No RE Pros found'
            }, { status: 400 });
        }
        
        console.log(`[zohoSyncREPros] Processing ${allREPros.length} RE Pros`);
        
        let created = 0;
        let updated = 0;
        const sampleFields = allREPros.length > 0 ? Object.keys(allREPros[0]) : [];

        for (const zohoREPro of allREPros.slice(0, limit)) {
            try {
                const reProData = {
                    rep_name: zohoREPro.Name || zohoREPro.Full_Name,
                    rep_email: zohoREPro.Email,
                    rep_phone: zohoREPro.Phone || zohoREPro.Mobile,
                    brokerage: zohoREPro.Brokerage || zohoREPro.Company,
                    license_number: zohoREPro.License_Number,
                    rep_type: zohoREPro.Type || 'Other',
                    zoho_id: zohoREPro.id
                };

                const existing = await base44.asServiceRole.entities.REPro.filter({ 
                    zoho_id: zohoREPro.id 
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.REPro.update(existing[0].id, reProData);
                    updated++;
                } else {
                    await base44.asServiceRole.entities.REPro.create(reProData);
                    created++;
                }

                // Tag users as RE Pro or Combo
                if (reProData.rep_email) {
                    const users = await base44.asServiceRole.entities.User.filter({ 
                        email: reProData.rep_email 
                    });

                    if (users.length > 0) {
                        const existingUser = users[0];
                        const hasCustomerData = await base44.asServiceRole.entities.Policy.filter({
                            customer_email: reProData.rep_email
                        });

                        const newType = hasCustomerData.length > 0 ? 'Combo' : 'RE Pro';
                        
                        if (existingUser.customer_type !== newType) {
                            await base44.asServiceRole.entities.User.update(existingUser.id, {
                                customer_type: newType
                            });
                        }
                    }
                }
            } catch (err) {
                console.log(`[zohoSyncREPros] Error processing RE Pro:`, err.message);
                errors.push({ rep: zohoREPro.Name, error: err.message });
            }
        }
        
        console.log(`[zohoSyncREPros] Sync complete: ${created} created, ${updated} updated`);

        return Response.json({ 
          success: true,
          created,
          updated,
          total: allREPros.length,
          errors: errors.length > 0 ? errors : undefined,
          debugInfo: {
              availableFields: sampleFields,
              sampleRecord: allREPros.length > 0 ? allREPros[0] : null
          }
        });

    } catch (error) {
        console.log('[zohoSyncREPros] Fatal error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});