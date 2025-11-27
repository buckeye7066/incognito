import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { aliasId, profileId } = await req.json();

    if (!aliasId) {
      return Response.json({ error: 'aliasId is required' }, { status: 400 });
    }

    // Get the alias
    const allAliases = await base44.asServiceRole.entities.DisposableCredential.list();
    const alias = allAliases.find(a => a.id === aliasId);

    if (!alias) {
      return Response.json({ error: 'Alias not found' }, { status: 404 });
    }

    // Security check - ensure alias belongs to user's profile
    if (alias.profile_id !== profileId) {
      return Response.json({ error: 'Unauthorized access to alias' }, { status: 403 });
    }

    // Soft-delete: mark as revoked instead of hard delete
    await base44.asServiceRole.entities.DisposableCredential.update(aliasId, {
      is_active: false,
      revoked: true,
      revoked_date: new Date().toISOString()
    });

    // SECURITY: Mask alias in response
    const maskedAlias = alias.credential_value.replace(/(.{3}).+(@.+)/, "$1***$2");

    return Response.json({
      success: true,
      message: `Alias ${maskedAlias} has been revoked`,
      aliasId: aliasId
    });

  } catch (error) {
    // SECURITY: Do not log full error details
    console.error('Email alias deletion error occurred');
    return Response.json({ error: 'Failed to delete alias' }, { status: 500 });
  }
});