import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { LegalCaseCandidateSchema, LegalCaseDiscoveryRequestSchema } from './shared/legalSchemas.ts';
import { redactForLog } from './shared/redact.ts';

function firstMatch(re: RegExp, text: string) {
  const m = text.match(re);
  return m?.[1]?.trim() || null;
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function tryExtractCaseNameFromTitle(title: string) {
  const t = normalizeWhitespace(title);
  // Very loose: "A v. B" or "A vs. B"
  const m = t.match(/(.+?)\s+v(?:s\.)?\s+(.+?)(?:\s+[-|–].*)?$/i);
  if (!m) return null;
  return `${m[1].trim()} v. ${m[2].trim()}`;
}

function extractDefendant(caseName: string) {
  const parts = caseName.split(/\sv\.\s/i);
  if (parts.length !== 2) return null;
  return parts[1].trim();
}

async function fetchText(url: string) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'incognito-legal-discovery/1.0 (+no-fabrication)' }
  });
  if (!resp.ok) {
    return { ok: false as const, status: resp.status, text: '' };
  }
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/pdf')) {
    // We won't attempt binary parsing here; caller can provide HTML/text sources.
    return { ok: false as const, status: 415, text: '' };
  }
  const text = await resp.text();
  return { ok: true as const, status: resp.status, text };
}

function extractFromHtml(url: string, html: string) {
  const now = new Date().toISOString();

  const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html) || '';
  const caseName = tryExtractCaseNameFromTitle(title);
  if (!caseName) return null;

  const defendant = extractDefendant(caseName);
  if (!defendant) return null;

  // Try a few common docket patterns.
  const caseNumber =
    firstMatch(/Case\s+(?:No\.|Number)\s*[:#]?\s*<\/?[^>]*>\s*([A-Za-z0-9:\-_.]+)\b/i, html) ||
    firstMatch(/Docket\s+(?:No\.|Number)\s*[:#]?\s*<\/?[^>]*>\s*([A-Za-z0-9:\-_.]+)\b/i, html) ||
    firstMatch(/\b(\d{1,2}:\d{2}-[a-z]{2,4}-\d{1,6})\b/i, html);
  if (!caseNumber) return null;

  const court =
    firstMatch(/U\.S\.\s+District\s+Court[^<]{0,120}/i, html) ||
    firstMatch(/United\s+States\s+District\s+Court[^<]{0,120}/i, html) ||
    firstMatch(/Superior\s+Court[^<]{0,120}/i, html) ||
    firstMatch(/Court\s+of\s+Common\s+Pleas[^<]{0,120}/i, html) ||
    'unknown';

  const filingDate =
    firstMatch(/Filed\s*[:#]?\s*<\/?[^>]*>\s*(\d{4}-\d{2}-\d{2})/i, html) ||
    firstMatch(/Filed\s*[:#]?\s*<\/?[^>]*>\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i, html) ||
    firstMatch(/Date\s+Filed\s*[:#]?\s*<\/?[^>]*>\s*(\d{4}-\d{2}-\d{2})/i, html);
  if (!filingDate) return null;

  const status =
    firstMatch(/Status\s*[:#]?\s*<\/?[^>]*>\s*([A-Za-z][A-Za-z \-]{2,80})/i, html) || 'unknown';

  const candidate = {
    case_name: normalizeWhitespace(caseName),
    court: normalizeWhitespace(court),
    case_number: normalizeWhitespace(caseNumber),
    filing_date: normalizeWhitespace(filingDate),
    defendant: normalizeWhitespace(defendant),
    status: normalizeWhitespace(status),
    source_url: url,
    retrieved_at: now
  };

  const parsed = LegalCaseCandidateSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'legalDiscoverCases' });
    }

    const parsedReq = LegalCaseDiscoveryRequestSchema.safeParse(body);
    if (!parsedReq.success) {
      return Response.json(
        { error: 'sourceUrls (array of URLs) is required', details: parsedReq.error.issues },
        { status: 400 }
      );
    }

    const candidates = [];
    const errors: Array<{ source_url: string; status?: number; reason: string }> = [];

    for (const url of parsedReq.data.sourceUrls.slice(0, 10)) {
      try {
        const fetched = await fetchText(url);
        if (!fetched.ok) {
          errors.push({ source_url: url, status: fetched.status, reason: 'fetch_failed_or_unsupported_content_type' });
          continue;
        }
        const candidate = extractFromHtml(url, fetched.text);
        if (!candidate) {
          errors.push({ source_url: url, reason: 'insufficient_structured_fields_found' });
          continue;
        }
        candidates.push(candidate);
      } catch {
        errors.push({ source_url: url, reason: 'exception' });
      }
    }

    return Response.json({
      success: true,
      candidates,
      errors,
      message:
        candidates.length > 0
          ? `Discovered ${candidates.length} case(s) from provided sources.`
          : 'No cases discovered. Provide docket/case pages that show case name, number, court, and filing date.'
    });
  } catch (e) {
    console.error(`legalDiscoverCases error occurred: ${redactForLog(e?.message)}`);
    return Response.json({ error: 'Failed to discover cases' }, { status: 500 });
  }
});

