import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { FilingGuidanceRequestSchema } from './shared/legalSchemas.ts';
import { redactForLog } from './shared/redact.ts';

type Citation = { title: string; url: string };

const CITATIONS: Citation[] = [
  { title: 'FTC Identity Theft: IdentityTheft.gov', url: 'https://www.identitytheft.gov/' },
  { title: 'FTC: ReportFraud.ftc.gov', url: 'https://reportfraud.ftc.gov/' },
  { title: 'AnnualCreditReport.com (official site)', url: 'https://www.annualcreditreport.com/' },
  { title: 'PACER (Federal court electronic records)', url: 'https://pacer.uscourts.gov/' }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'legalGenerateFilingGuidance' });
    }

    const parsed = FilingGuidanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'profileId is required', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { profileId, incidentSummary, jurisdictionHint } = parsed.data;

    // Pull non-PII context from existing entities (counts and types only).
    const [scanResults, socialFindings, deletionRequests, fixLogs] = await Promise.all([
      base44.asServiceRole.entities.ScanResult.list(),
      base44.asServiceRole.entities.SocialMediaFinding.list(),
      base44.asServiceRole.entities.DeletionRequest.list(),
      base44.asServiceRole.entities.ExposureFixLog.list()
    ]);

    const sr = scanResults.filter((r) => r.profile_id === profileId);
    const sf = socialFindings.filter((f) => f.profile_id === profileId);
    const dr = deletionRequests.filter((r) => r.profile_id === profileId);
    const fl = fixLogs.filter((l) => l.profile_id === profileId);

    const guidance = {
      needs_attorney_review: true,
      disclaimers: [
        'This is general information, not legal advice.',
        'Venue, claims, deadlines, and strategy depend on jurisdiction-specific facts; consult an attorney.',
        'Incognito will not guess court venue or invent case law; provide source URLs for any docket/case references.'
      ],
      context: {
        profile_id: profileId,
        jurisdiction_hint: jurisdictionHint || null,
        incident_summary_user: incidentSummary || null,
        indicators: {
          scan_results: sr.length,
          impersonation_findings: sf.length,
          deletion_requests: dr.length,
          remediation_actions: fl.length
        }
      },
      options: [
        {
          option: 'Administrative / consumer-protection path (recommended early)',
          why: [
            'Creates an official record and a recovery plan (identity theft).',
            'Can support later disputes, remediation, and attorney review.'
          ],
          steps: [
            'File an identity theft report and follow the recovery checklist.',
            'Pull credit reports and consider placing a fraud alert or freeze (if applicable).',
            'Document remediation costs and time spent (keep receipts and a timeline).'
          ],
          citations: [
            'https://www.identitytheft.gov/',
            'https://www.annualcreditreport.com/'
          ]
        },
        {
          option: 'Platform + broker takedown workflow (parallel)',
          why: [
            'Fastest way to reduce ongoing harm from impersonation or data broker listings.',
            'Creates a paper trail of requests and responses.'
          ],
          steps: [
            'Submit platform impersonation reports and request preservation of records.',
            'Submit broker opt-out/deletion requests; track confirmation/rejection.',
            'If rejected, escalate using the broker’s published appeal channel and keep copies of all messages.'
          ],
          citations: []
        },
        {
          option: 'Litigation readiness (only when you have sources + damages)',
          why: [
            'Civil claims generally require clear evidence, jurisdiction-appropriate causes of action, and damages.',
            'Early preservation helps counsel evaluate feasibility.'
          ],
          steps: [
            'Export a Legal Intake Packet (timeline + hashed evidence list) from Incognito.',
            'Collect authoritative source URLs (dockets, complaints, platform URLs) for any case/court references.',
            'Work with counsel to evaluate venue, claims, injunctive relief, and discovery strategy.'
          ],
          citations: []
        }
      ],
      citations: CITATIONS
    };

    return Response.json({ success: true, guidance });
  } catch (e) {
    console.error(`legalGenerateFilingGuidance error occurred: ${redactForLog(e?.message)}`);
    return Response.json({ error: 'Failed to generate filing guidance' }, { status: 500 });
  }
});

