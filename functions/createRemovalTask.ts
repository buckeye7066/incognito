import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { z } from 'npm:zod@3.24.2';
import { redactForLog } from './shared/redact.ts';

const CreateRemovalTaskSchema = z
  .object({
    profileId: z.string().min(1),
    task_type: z.enum(['data_broker_opt_out', 'platform_takedown']),
    source_name: z.string().min(1),
    source_url: z.string().url().optional(),
    contact_email: z.string().email().optional(),
    notes: z.string().optional()
  })
  .strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'createRemovalTask' });
    }

    const parsed = CreateRemovalTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const { profileId, task_type, source_name, source_url, contact_email, notes } = parsed.data;

    const created = await base44.asServiceRole.entities.DeletionRequest.create({
      profile_id: profileId,
      request_type: task_type, // extra field for task classification
      source_name,
      source_url: source_url || '',
      contact_email: contact_email || '',
      status: 'pending',
      created_date: new Date().toISOString(),
      next_action: notes || 'Prepare and send opt-out/takedown request',
      audit_trail: [
        {
          at: new Date().toISOString(),
          by: 'system',
          action: 'created',
          details: `task_type=${task_type}`
        }
      ]
    });

    return Response.json({ success: true, task: created });
  } catch (e) {
    console.error(`createRemovalTask error occurred: ${redactForLog(e?.message)}`);
    return Response.json({ error: 'Failed to create removal task' }, { status: 500 });
  }
});

