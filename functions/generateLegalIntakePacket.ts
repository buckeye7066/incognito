import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { buildEvidenceItem } from './shared/evidence.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'generateLegalIntakePacket' });
    }

    const { profileId } = body;
    if (!profileId) {
      return Response.json({ error: 'profileId is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const [
      profiles,
      personalData,
      scanResults,
      socialFindings,
      socialMentions,
      deletionRequests,
      deletionResponses,
      fixLogs,
      spamIncidents
    ] = await Promise.all([
      base44.asServiceRole.entities.Profile.list(),
      base44.asServiceRole.entities.PersonalData.list(),
      base44.asServiceRole.entities.ScanResult.list(),
      base44.asServiceRole.entities.SocialMediaFinding.list(),
      base44.asServiceRole.entities.SocialMediaMention.list(),
      base44.asServiceRole.entities.DeletionRequest.list(),
      base44.asServiceRole.entities.DeletionEmailResponse.list(),
      base44.asServiceRole.entities.ExposureFixLog.list(),
      base44.asServiceRole.entities.SpamIncident.list()
    ]);

    const profile = profiles.find((p) => p.id === profileId);
    const vault = personalData.filter((d) => d.profile_id === profileId);
    const profileScanResults = scanResults.filter((r) => r.profile_id === profileId);
    const profileSocialFindings = socialFindings.filter((f) => f.profile_id === profileId);
    const profileSocialMentions = socialMentions.filter((m) => m.profile_id === profileId);
    const profileDeletionRequests = deletionRequests.filter((r) => r.profile_id === profileId);
    const profileFixLogs = fixLogs.filter((l) => l.profile_id === profileId);
    const profileSpam = spamIncidents.filter((s) => s.profile_id === profileId);

    // Evidence integrity: build hashed evidence items for everything we can point at by URL.
    const evidence: Array<Awaited<ReturnType<typeof buildEvidenceItem>>> = [];

    for (const r of profileScanResults) {
      const url = r.source_url;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
      evidence.push(
        await buildEvidenceItem({
          source_url: url,
          captured_at: r.scan_date ? `${r.scan_date}T00:00:00.000Z` : now,
          retrieved_at: now,
          method: 'base44.entity.ScanResult',
          entity: 'ScanResult',
          entity_id: r.id,
          content_verbatim: (r.metadata && r.metadata.explanation) || undefined
        })
      );
    }

    for (const f of profileSocialFindings) {
      const url = f.suspicious_profile_url;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
      const content = [
        f.misused_data_details?.full_name ? `Display Name: "${f.misused_data_details.full_name}"` : null,
        f.misused_data_details?.bio ? `Bio: "${f.misused_data_details.bio}"` : null,
        f.misused_data_details?.location ? `Location: "${f.misused_data_details.location}"` : null,
        f.misused_data_details?.workplace ? `Employer: "${f.misused_data_details.workplace}"` : null
      ]
        .filter(Boolean)
        .join('\n');

      evidence.push(
        await buildEvidenceItem({
          source_url: url,
          captured_at: f.detected_date ? `${f.detected_date}T00:00:00.000Z` : now,
          retrieved_at: now,
          method: 'base44.entity.SocialMediaFinding',
          entity: 'SocialMediaFinding',
          entity_id: f.id,
          content_verbatim: content || undefined
        })
      );
    }

    for (const m of profileSocialMentions) {
      const url = m.post_url || m.author_profile_url;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
      evidence.push(
        await buildEvidenceItem({
          source_url: url,
          captured_at: m.published_date || m.detected_date || now,
          retrieved_at: now,
          method: 'base44.entity.SocialMediaMention',
          entity: 'SocialMediaMention',
          entity_id: m.id,
          content_verbatim: m.content || undefined
        })
      );
    }

    // Timeline (non-exhaustive but structured)
    const timeline = [
      ...profileScanResults.map((r) => ({
        at: r.scan_date ? `${r.scan_date}T00:00:00.000Z` : now,
        type: 'scan_result',
        summary: `${r.source_name || 'Source'} (${r.source_type || 'unknown'})`,
        source_url: r.source_url || null,
        entity_id: r.id
      })),
      ...profileSocialFindings.map((f) => ({
        at: f.detected_date ? `${f.detected_date}T00:00:00.000Z` : now,
        type: 'impersonation',
        summary: `${f.platform || 'platform'} @${f.suspicious_username || 'unknown'}`,
        source_url: f.suspicious_profile_url || null,
        entity_id: f.id
      })),
      ...profileDeletionRequests.map((r) => ({
        at: r.created_date || now,
        type: 'deletion_request',
        summary: `${r.source_name || 'Source'} (${r.status || 'unknown'})`,
        source_url: r.source_url || null,
        entity_id: r.id
      })),
      ...profileFixLogs.map((l) => ({
        at: l.created_date || now,
        type: 'remediation_action',
        summary: `${l.action_type || 'action'} (${l.status || 'unknown'})`,
        source_url: l.source_url || null,
        entity_id: l.id
      }))
    ].sort((a, b) => String(a.at).localeCompare(String(b.at)));

    const packetJson = {
      generated_at: now,
      profile: {
        id: profileId,
        name: profile?.name || null
      },
      // NOTE: We do NOT echo raw vault values in this packet by default.
      vault_summary: {
        total_items: vault.length,
        data_types: [...new Set(vault.map((v) => v.data_type))].filter(Boolean)
      },
      remediation: {
        deletion_requests: profileDeletionRequests.map((r) => ({
          id: r.id,
          source_name: r.source_name || null,
          status: r.status || null,
          created_date: r.created_date || null,
          completion_date: r.completion_date || null
        })),
        deletion_responses: deletionResponses
          .filter((dr) => profileDeletionRequests.some((r) => r.id === dr.deletion_request_id))
          .map((dr) => ({
            id: dr.id,
            deletion_request_id: dr.deletion_request_id,
            response_type: dr.response_type || null,
            detected_date: dr.detected_date || null,
            confidence_score: dr.confidence_score || null
          })),
        fix_logs: profileFixLogs.map((l) => ({
          id: l.id,
          action_type: l.action_type || null,
          status: l.status || null,
          created_date: l.created_date || null
        }))
      },
      incidents: {
        scan_results: profileScanResults.length,
        impersonations: profileSocialFindings.length,
        mentions: profileSocialMentions.length,
        spam_incidents: profileSpam.length
      },
      evidence
    };

    const packetText = [
      `INCÓGNITO — Legal Intake Packet`,
      `Generated: ${now}`,
      `Profile: ${profile?.name || profileId}`,
      ``,
      `## Summary`,
      `- Scan results: ${profileScanResults.length}`,
      `- Social impersonation findings: ${profileSocialFindings.length}`,
      `- Social mentions: ${profileSocialMentions.length}`,
      `- Spam incidents: ${profileSpam.length}`,
      `- Deletion requests: ${profileDeletionRequests.length}`,
      `- Remediation actions: ${profileFixLogs.length}`,
      ``,
      `## Timeline (high level)`,
      ...timeline.slice(0, 200).map((t) => `- ${t.at}: [${t.type}] ${t.summary}${t.source_url ? ` (${t.source_url})` : ''}`),
      ``,
      `## Evidence (hashed)`,
      ...evidence.map((e) => `- ${e.captured_at} | ${e.source_url}\n  - sha256: ${e.sha256}\n  - retrieved_at: ${e.retrieval.retrieved_at}\n  - method: ${e.retrieval.method}`)
    ].join('\n');

    return Response.json({
      success: true,
      generatedAt: now,
      packet: {
        text: packetText,
        json: packetJson
      }
    });
  } catch {
    console.error('generateLegalIntakePacket error occurred');
    return Response.json({ error: 'Failed to generate legal intake packet' }, { status: 500 });
  }
});

