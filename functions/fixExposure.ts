import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { exposureId, exposureType, profileId, exposureData } = await req.json();

    if (!exposureId || !exposureType || !profileId) {
      return Response.json({ 
        error: 'exposureId, exposureType, and profileId are required' 
      }, { status: 400 });
    }

    // Generate idempotency key
    const idempotencyKey = `fix-${exposureId}-${exposureType}-${Date.now()}`;

    // Check for duplicate action
    const allLogs = await base44.asServiceRole.entities.ExposureFixLog.list();
    const existingAction = allLogs.find(l => 
      l.exposure_id === exposureId && 
      l.action_type === exposureType &&
      l.status !== 'failed'
    );

    if (existingAction) {
      return Response.json({
        success: false,
        error: 'Action already in progress or completed',
        existing_action: existingAction
      });
    }

    const actionsStarted = [];
    const nextSteps = [];
    let evidencePacketGenerated = false;

    // Platform-specific takedown URLs
    const takedownUrls = {
      facebook: 'https://www.facebook.com/help/contact/169486816475808',
      instagram: 'https://help.instagram.com/contact/636276399721841',
      twitter: 'https://help.twitter.com/forms/impersonation',
      x: 'https://help.twitter.com/forms/impersonation',
      tiktok: 'https://www.tiktok.com/legal/report/privacy',
      linkedin: 'https://www.linkedin.com/help/linkedin/ask/TS-NFPI',
      youtube: 'https://support.google.com/youtube/answer/2801947'
    };

    switch (exposureType) {
      case 'impersonation': {
        // Generate takedown notices
        const platform = exposureData?.platform?.toLowerCase() || 'unknown';
        const takedownUrl = takedownUrls[platform] || null;

        const takedownPrompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate details or evidence.
- ONLY use the provided information.
- Keep the report factual and professional.

Generate a professional impersonation report for ${platform || 'social media platform'}.

Suspected impersonating account: @${exposureData?.suspicious_username || '[username]'}
Profile URL: ${exposureData?.suspicious_profile_url || '[not available]'}

The report should:
1. Clearly state this is an impersonation report
2. Explain what personal data was copied
3. Request immediate account suspension/removal
4. Be professional and factual

Return JSON with: report_text, subject_line, key_points`;

        const takedownDraft = await base44.integrations.Core.InvokeLLM({
          prompt: takedownPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              report_text: { type: "string" },
              subject_line: { type: "string" },
              key_points: { type: "array", items: { type: "string" } }
            }
          }
        });

        // Save log
        await base44.asServiceRole.entities.ExposureFixLog.create({
          exposure_id: exposureId,
          profile_id: profileId,
          action_type: 'takedown_request',
          provider: platform,
          status: 'pending',
          idempotency_key: idempotencyKey,
          notes: `Takedown draft generated for ${platform}`,
          metadata: {
            takedown_url: takedownUrl,
            draft: takedownDraft
          }
        });

        actionsStarted.push('takedown_request');
        nextSteps.push(`Visit ${takedownUrl || 'the platform'} to submit impersonation report`);
        nextSteps.push('Save screenshots of the impersonating profile');
        nextSteps.push('Document any messages sent by the impersonator');
        break;
      }

      case 'data_broker': {
        // Call automated deletion
        try {
          const deletionResult = await base44.functions.invoke('automateDataDeletion', {
            profileId,
            scanResultIds: [exposureId]
          });

          await base44.asServiceRole.entities.ExposureFixLog.create({
            exposure_id: exposureId,
            profile_id: profileId,
            action_type: 'deletion_request',
            provider: exposureData?.source_name || 'data_broker',
            status: deletionResult.data?.success ? 'in_progress' : 'failed',
            idempotency_key: idempotencyKey,
            notes: `Automated deletion request sent`,
            metadata: deletionResult.data
          });

          actionsStarted.push('deletion_request');
          nextSteps.push('Monitor email for deletion confirmation (7-45 days typical)');
          nextSteps.push('If no response in 30 days, escalate to state AG');

          // Trigger monitoring
          await base44.functions.invoke('monitorDeletionResponses', { profileId });
          actionsStarted.push('response_monitoring');

        } catch (err) {
          await base44.asServiceRole.entities.ExposureFixLog.create({
            exposure_id: exposureId,
            profile_id: profileId,
            action_type: 'deletion_request',
            provider: exposureData?.source_name || 'data_broker',
            status: 'failed',
            idempotency_key: idempotencyKey,
            notes: `Deletion failed: ${err.message}`
          });
        }
        break;
      }

      case 'breach': {
        // Password rotation advice
        const affectedServices = exposureData?.data_exposed || [];
        
        const advicePrompt = `IMPORTANT: Provide factual security advice only. No speculation.

A data breach has affected these data types: ${affectedServices.join(', ')}
Breach source: ${exposureData?.source_name || 'Unknown'}

Provide specific, actionable password rotation advice:
1. Which account types should be rotated first
2. How to check for unauthorized access
3. Credit monitoring recommendations if financial data exposed
4. Identity monitoring recommendations if SSN/DOB exposed

Return JSON with: immediate_actions, password_advice, monitoring_recommendations`;

        const securityAdvice = await base44.integrations.Core.InvokeLLM({
          prompt: advicePrompt,
          response_json_schema: {
            type: "object",
            properties: {
              immediate_actions: { type: "array", items: { type: "string" } },
              password_advice: { type: "array", items: { type: "string" } },
              monitoring_recommendations: { type: "array", items: { type: "string" } }
            }
          }
        });

        // Check for class actions
        let classActionMatches = [];
        try {
          const caResult = await base44.functions.invoke('checkClassActions', {
            companyName: exposureData?.source_name,
            breachName: exposureData?.source_name
          });
          classActionMatches = caResult.data?.litigation || [];
        } catch (e) {
          // Class action check failed, continue
        }

        await base44.asServiceRole.entities.ExposureFixLog.create({
          exposure_id: exposureId,
          profile_id: profileId,
          action_type: 'password_rotation_advised',
          provider: exposureData?.source_name || 'breach_source',
          status: 'completed',
          idempotency_key: idempotencyKey,
          notes: 'Security advice provided',
          metadata: {
            advice: securityAdvice,
            class_actions: classActionMatches
          }
        });

        actionsStarted.push('password_rotation_advised');
        if (classActionMatches.length > 0) {
          actionsStarted.push('class_action_check');
          nextSteps.push(`${classActionMatches.length} potential class action(s) found - review in Legal Support`);
        }
        nextSteps.push(...(securityAdvice.immediate_actions || []));
        break;
      }

      case 'public_exposure':
      case 'social_media_exposure': {
        // Generate DMCA takedown and abuse contact letter
        const dmcaPrompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate details.
- Keep factual and professional.
- This is a template, not legal advice.

Generate a DMCA takedown notice template for:
Website: ${exposureData?.source_url || '[website]'}
Content: Personal information/photos being used without consent

Also generate an abuse contact letter for the hosting provider.

Return JSON with: dmca_notice, abuse_letter, filing_instructions`;

        const legalDrafts = await base44.integrations.Core.InvokeLLM({
          prompt: dmcaPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              dmca_notice: { type: "string" },
              abuse_letter: { type: "string" },
              filing_instructions: { type: "array", items: { type: "string" } }
            }
          }
        });

        await base44.asServiceRole.entities.ExposureFixLog.create({
          exposure_id: exposureId,
          profile_id: profileId,
          action_type: 'dmca_notice',
          provider: exposureData?.source_name || 'website',
          status: 'pending',
          idempotency_key: idempotencyKey,
          notes: 'DMCA and abuse letters drafted',
          metadata: {
            drafts: legalDrafts
          }
        });

        actionsStarted.push('dmca_notice');
        actionsStarted.push('abuse_report');
        nextSteps.push('Send DMCA notice to website contact');
        nextSteps.push('If no DMCA response in 48 hours, contact hosting abuse team');
        break;
      }

      case 'darkweb_exposure': {
        // High priority - identity theft risk
        await base44.asServiceRole.entities.ExposureFixLog.create({
          exposure_id: exposureId,
          profile_id: profileId,
          action_type: 'identity_theft_report',
          provider: 'dark_web',
          status: 'pending',
          idempotency_key: idempotencyKey,
          notes: 'Dark web exposure detected - identity protection recommended'
        });

        actionsStarted.push('identity_theft_report');
        nextSteps.push('Place fraud alert with credit bureaus (Equifax, Experian, TransUnion)');
        nextSteps.push('Consider credit freeze');
        nextSteps.push('File identity theft report at IdentityTheft.gov');
        nextSteps.push('Monitor credit reports for 12+ months');
        break;
      }

      case 'identity_theft_suspected': {
        await base44.asServiceRole.entities.ExposureFixLog.create({
          exposure_id: exposureId,
          profile_id: profileId,
          action_type: 'identity_theft_report',
          provider: 'multiple',
          status: 'pending',
          idempotency_key: idempotencyKey,
          notes: 'Identity theft suspected - comprehensive response initiated'
        });

        actionsStarted.push('identity_theft_report');
        nextSteps.push('File FTC Identity Theft Report at IdentityTheft.gov');
        nextSteps.push('File police report in your jurisdiction');
        nextSteps.push('Place fraud alerts with all three credit bureaus');
        nextSteps.push('Request free credit reports');
        nextSteps.push('Contact affected financial institutions');
        nextSteps.push('Consider identity theft protection service');
        break;
      }

      default:
        return Response.json({ 
          error: `Unknown exposure type: ${exposureType}` 
        }, { status: 400 });
    }

    // Generate evidence packet for all cases
    try {
      await base44.functions.invoke('generateEvidencePacket', {
        findingId: exposureId,
        profileId
      });
      evidencePacketGenerated = true;
      actionsStarted.push('evidence_packet');
    } catch (e) {
      // Evidence packet generation failed, continue
    }

    // Create notification
    await base44.asServiceRole.entities.NotificationAlert.create({
      profile_id: profileId,
      alert_type: 'mitigation_reminder',
      title: `Remediation Started: ${exposureType.replace(/_/g, ' ')}`,
      message: `Started ${actionsStarted.length} action(s) to fix your exposure. Next: ${nextSteps[0] || 'Check Legal Support for details.'}`,
      severity: 'medium',
      is_read: false
    });

    return Response.json({
      success: true,
      actions_started: actionsStarted,
      next_steps: nextSteps,
      evidence_packet: evidencePacketGenerated,
      idempotency_key: idempotencyKey
    });

  } catch (error) {
    console.error('Fix exposure error occurred');
    return Response.json({ 
      error: 'Failed to process exposure fix',
      details: 'An error occurred during remediation'
    }, { status: 500 });
  }
});