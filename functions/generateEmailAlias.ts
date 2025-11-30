/**
 * Generate Email Alias
 * 
 * Generates a deterministic email alias for a profile.
 * Does not call external SimpleLogin API - operates locally.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await req.json();
    
    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'generateEmailAlias' });
    }
    
    const { profileId, purpose, website } = body;

    // Validate profileId
    if (!profileId) {
      return Response.json({ 
        success: false, 
        error: 'profileId is required' 
      }, { status: 400 });
    }

    // Build deterministic alias without external API
    const safePurpose = (purpose || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const safeDomain = (website || 'alias.local').toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/g, '');
    
    // Create a unique-ish local part from profileId
    const profileSlug = profileId.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '');
    const timestamp = Date.now().toString(36).slice(-4);
    
    const aliasLocalPart = `${profileSlug}-${safePurpose}-${timestamp}`;
    const alias = `${aliasLocalPart}@${safeDomain}`;

    // Optionally store in database
    try {
      await base44.asServiceRole.entities.DisposableCredential.create({
        profile_id: profileId,
        credential_type: 'email',
        service_provider: 'Internal',
        credential_value: alias,
        purpose: purpose || 'Email Alias',
        created_for_website: website || '',
        is_active: true
      });
    } catch {
      // If storage fails, still return the alias
    }

    return Response.json({
      success: true,
      alias
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: `Failed to generate alias: ${error.message}`
    }, { status: 500 });
  }
});