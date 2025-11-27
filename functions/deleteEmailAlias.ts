import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { aliasId } = await req.json();

    if (!aliasId) {
      return Response.json({ error: 'aliasId is required' }, { status: 400 });
    }

    // Get the alias
    const allCredentials = await base44.asServiceRole.entities.DisposableCredential.list();
    const alias = allCredentials.find(c => c.id === aliasId && c.credential_type === 'email');

    if (!alias) {
      return Response.json({ error: 'Alias not found' }, { status: 404 });
    }

    // Soft-delete: mark as revoked instead of hard delete
    await base44.asServiceRole.entities.DisposableCredential.update(aliasId, {
      is_active: false,
      revoked: true,
      revoked_date: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Email alias deactivated successfully'
    });

  } catch (error) {
    console.error('Alias deletion error');
    return Response.json({ error: 'Failed to delete alias' }, { status: 500 });
  }
});