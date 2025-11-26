import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { findingId, findingType, profileId } = await req.json();

    if (!findingId || !profileId) {
      return Response.json({ error: 'findingId and profileId are required' }, { status: 400 });
    }

    // Get the finding details based on type
    let finding = null;
    let sourceName = '';
    let sourceUrl = '';
    let sourceType = '';
    let dataExposed = [];

    if (findingType === 'social_media') {
      const findings = await base44.asServiceRole.entities.SocialMediaFinding.list();
      finding = findings.find(f => f.id === findingId);
      if (finding) {
        sourceName = finding.platform;
        sourceUrl = finding.suspicious_profile_url || '';
        sourceType = 'social_media';
        dataExposed = finding.misused_data || [];
      }
    } else if (findingType === 'mention') {
      const mentions = await base44.asServiceRole.entities.SocialMediaMention.list();
      finding = mentions.find(m => m.id === findingId);
      if (finding) {
        sourceName = finding.platform;
        sourceUrl = finding.post_url || '';
        sourceType = 'social_media';
        dataExposed = finding.exposed_data || [];
      }
    } else {
      // Default: scan result
      const results = await base44.asServiceRole.entities.ScanResult.list();
      finding = results.find(r => r.id === findingId);
      if (finding) {
        sourceName = finding.source_name;
        sourceUrl = finding.source_url || '';
        sourceType = finding.source_type || 'data_broker';
        dataExposed = finding.data_exposed || [];
      }
    }

    if (!finding) {
      return Response.json({ error: 'Finding not found' }, { status: 404 });
    }

    // Get user's personal data for the request
    const allPersonalData = await base44.asServiceRole.entities.PersonalData.list();
    const personalData = allPersonalData.filter(d => d.profile_id === profileId);

    const userData = {};
    personalData.forEach(d => {
      userData[d.data_type] = d.value;
    });

    // Use AI to research the site and generate deletion request details
    const researchPrompt = `You are a GDPR/CCPA data deletion request specialist. Research this data source and provide complete deletion request information.

DATA SOURCE TO RESEARCH:
- Name: ${sourceName}
- URL: ${sourceUrl}
- Type: ${sourceType}
- Data Exposed: ${dataExposed.join(', ')}

USER'S DATA (to be deleted):
${Object.entries(userData).map(([k, v]) => `${k}: ${v}`).join('\n')}

RESEARCH AND PROVIDE:
1. The official privacy/data deletion contact for this site
2. The correct method to request deletion (email, web form, postal mail)
3. A pre-written GDPR Article 17 / CCPA deletion request
4. Any specific requirements this site has for deletion requests
5. Expected response timeline
6. Alternative escalation contacts if they don't respond

For the deletion request email/letter:
- Make it legally sound citing GDPR Article 17 (Right to Erasure) and CCPA rights
- Include all necessary user identification info
- Be professional but firm
- Request confirmation of deletion within 30 days
- Mention regulatory complaint as escalation

IMPORTANT: Search for the ACTUAL contact methods for ${sourceName}. Check their privacy policy, terms of service, and any opt-out pages.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: researchPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          site_name: { type: "string" },
          deletion_methods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                method: { type: "string", enum: ["email", "web_form", "postal_mail", "phone", "online_portal"] },
                contact: { type: "string" },
                url: { type: "string" },
                instructions: { type: "string" }
              }
            }
          },
          primary_contact_email: { type: "string" },
          privacy_page_url: { type: "string" },
          opt_out_url: { type: "string" },
          pre_filled_email: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" }
            }
          },
          pre_filled_form_data: {
            type: "object",
            properties: {
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field_name: { type: "string" },
                    field_value: { type: "string" },
                    field_type: { type: "string" }
                  }
                }
              }
            }
          },
          special_requirements: { type: "array", items: { type: "string" } },
          expected_response_days: { type: "number" },
          escalation_contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                contact: { type: "string" },
                type: { type: "string" }
              }
            }
          },
          legal_basis: { type: "string" },
          success_likelihood: { type: "string", enum: ["high", "medium", "low"] },
          notes: { type: "string" }
        }
      }
    });

    // Create or update deletion request record
    const deletionRequest = await base44.asServiceRole.entities.DeletionRequest.create({
      profile_id: profileId,
      scan_result_id: findingType === 'scan_result' ? findingId : null,
      removal_method: result.deletion_methods?.[0]?.method === 'email' ? 'email_request' : 
                      result.deletion_methods?.[0]?.method === 'web_form' ? 'form_submission' : 'manual_contact',
      status: 'pending',
      request_date: new Date().toISOString().split('T')[0],
      contact_email: result.primary_contact_email,
      template_used: 'GDPR Article 17 / CCPA',
      notes: JSON.stringify({
        ai_generated: true,
        site_name: result.site_name,
        deletion_methods: result.deletion_methods,
        special_requirements: result.special_requirements,
        escalation_contacts: result.escalation_contacts,
        success_likelihood: result.success_likelihood
      }),
      next_action: result.deletion_methods?.[0]?.instructions || 'Review and send the pre-filled deletion request'
    });

    return Response.json({
      success: true,
      deletionRequestId: deletionRequest.id,
      site_name: result.site_name || sourceName,
      deletion_methods: result.deletion_methods || [],
      primary_contact_email: result.primary_contact_email,
      privacy_page_url: result.privacy_page_url,
      opt_out_url: result.opt_out_url,
      pre_filled_email: result.pre_filled_email,
      pre_filled_form_data: result.pre_filled_form_data,
      special_requirements: result.special_requirements || [],
      expected_response_days: result.expected_response_days || 30,
      escalation_contacts: result.escalation_contacts || [],
      legal_basis: result.legal_basis || 'GDPR Article 17 (Right to Erasure) and CCPA',
      success_likelihood: result.success_likelihood || 'medium',
      notes: result.notes,
      message: `AI has prepared a deletion request for ${sourceName}. Review and confirm to proceed.`
    });

  } catch (error) {
    console.error('GDPR deletion automation error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to automate deletion request'
    }, { status: 500 });
  }
});