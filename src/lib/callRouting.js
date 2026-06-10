/**
 * Central call routing for multi-number (family) coverage.
 *
 * This is the ONLY way to screen calls for several people from one place: each
 * covered person publishes a Twilio "screening number"; calls to it hit the
 * backend webhook, which asks this module what to do. On a permitted call it
 * dials the person's REAL phone (`forwardTo`) — the real phone does NOT forward
 * back to Twilio, so there is no loop. Reusing the on-device screening brain
 * (assessCaller/decideAction) keeps one consistent policy everywhere.
 *
 * Pure + Node-portable (explicit .js imports, no app-only deps) so the backend
 * in server/ can import it directly and it stays unit-testable.
 *
 * Topology (no carrier-forwarding loop):
 *   caller → [Twilio number you publish] → backend webhook → this decision
 *            → allow: <Dial> the real phone   → rings their actual line
 *            → block: <Reject>                 → caller hears "rejected"
 *            → screen: record name / voicemail → never silently dropped
 */
import { assessCaller, decideAction, ACTION } from './callScreening.js';
import { normalizePhone } from './phoneRules.js';

/** Telephony actions this module can ask the backend to render as TwiML. */
export const ROUTE = {
  REJECT: 'reject',
  VOICEMAIL: 'voicemail',
  SCREEN: 'screen',
  FORWARD: 'forward',
  RECORD_FORWARD: 'record_forward',
};

/** Keep a dialable form: a single leading + (if present) and the digits. */
function cleanDial(raw) {
  const s = String(raw || '').replace(/[^\d+]/g, '');
  return s.startsWith('+') ? `+${s.replace(/\+/g, '')}` : s.replace(/\+/g, '');
}

/** Normalize a coverage list into validated entries. */
export function normalizeCoverage(list) {
  return (Array.isArray(list) ? list : [])
    .map((c) => ({
      twilioNumber: normalizePhone(c.twilioNumber || c.number || ''),
      label: c.label || '',
      forwardTo: cleanDial(c.forwardTo || ''), // E.164-ish for dialing (keeps country code)
      contacts: (Array.isArray(c.contacts) ? c.contacts : []).map(normalizePhone).filter(Boolean),
      blocked: (Array.isArray(c.blocked) ? c.blocked : []).map(normalizePhone).filter(Boolean),
      policy: {
        autoBlockHighRisk: Boolean(c.policy?.autoBlockHighRisk),
        voicemailOnScreen: Boolean(c.policy?.voicemailOnScreen),
        record: Boolean(c.policy?.record),
      },
    }))
    .filter((c) => c.twilioNumber);
}

/** Find the coverage entry for the called (Twilio) number. */
export function findCoverage(coverage, toNumber) {
  const t = normalizePhone(toNumber);
  if (!t) return null;
  return normalizeCoverage(coverage).find((c) => c.twilioNumber === t) || null;
}

/**
 * Decide what to do with an inbound call to a covered number.
 *
 * @param {object} args
 * @param {string} args.from        caller ID
 * @param {string} args.to          the Twilio number that was called
 * @param {object[]} args.coverage  coverage entries
 * @param {string[]} [args.contacts] trusted numbers (allow)
 * @param {string[]} [args.blocked]  blocked numbers
 * @param {string[]} [args.history]  recent callers (repeat detection)
 * @returns {{ action:string, dialTo?:string, reason:string, label?:string,
 *            assessment?:object }}
 */
export function routeIncomingCall({ from, to, coverage = [], contacts = [], blocked = [], history = [] } = {}) {
  const cov = findCoverage(coverage, to);
  if (!cov) {
    // A call to a number we don't manage — refuse rather than blindly forward.
    return { action: ROUTE.REJECT, reason: 'number_not_covered' };
  }

  // Merge caller-supplied lists with the covered number's own allow/block lists.
  const allowList = [...(contacts || []), ...(cov.contacts || [])];
  const blockList = [...(blocked || []), ...(cov.blocked || [])];
  const assessment = assessCaller({
    number: from,
    myNumber: cov.forwardTo || cov.twilioNumber,
    contacts: allowList,
    blocked: blockList,
    history,
  });
  const decision = decideAction(assessment, { autoBlockHighRisk: cov.policy.autoBlockHighRisk });

  const base = { reason: decision, label: cov.label, assessment };
  if (decision === ACTION.BLOCK) {
    return { ...base, action: ROUTE.REJECT };
  }
  if (decision === ACTION.SCREEN) {
    return { ...base, action: cov.policy.voicemailOnScreen ? ROUTE.VOICEMAIL : ROUTE.SCREEN };
  }
  // allow → ring the real phone (optionally recorded)
  if (!cov.forwardTo) {
    // Allowed, but no real number to ring — fall back to voicemail, never drop.
    return { ...base, action: ROUTE.VOICEMAIL, reason: 'allow_no_forward' };
  }
  return { ...base, action: cov.policy.record ? ROUTE.RECORD_FORWARD : ROUTE.FORWARD, dialTo: cov.forwardTo };
}

function xml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
const wrap = (inner) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

/**
 * Render a routing decision as Twilio TwiML.
 * @param {ReturnType<typeof routeIncomingCall>} decision
 * @param {{ screenPrompt?:string, voicemailPrompt?:string, rejectMessage?:string }} [prompts]
 */
export function buildVoiceTwiml(decision, prompts = {}) {
  const screenPrompt = prompts.screenPrompt || 'Please say your name and reason for calling after the tone.';
  const voicemailPrompt = prompts.voicemailPrompt || 'Please leave a message after the tone.';
  const rejectMessage = prompts.rejectMessage || '';

  switch (decision?.action) {
    case ROUTE.FORWARD:
      return wrap(`<Dial>${xml(decision.dialTo)}</Dial>`);
    case ROUTE.RECORD_FORWARD:
      return wrap(`<Dial record="record-from-answer-dual">${xml(decision.dialTo)}</Dial>`);
    case ROUTE.SCREEN:
      return wrap(`<Say>${xml(screenPrompt)}</Say><Record maxLength="30" playBeep="true"/>`);
    case ROUTE.VOICEMAIL:
      return wrap(`<Say>${xml(voicemailPrompt)}</Say><Record maxLength="120" playBeep="true"/>`);
    case ROUTE.REJECT:
    default:
      return rejectMessage
        ? wrap(`<Say>${xml(rejectMessage)}</Say><Reject reason="rejected"/>`)
        : wrap('<Reject reason="rejected"/>');
  }
}

/** Metadata-only event for the backend log — never includes a recording/body. */
export function routeToEvent(decision, { from, to } = {}) {
  return {
    type: 'call_routed',
    from: from || '',
    to: to || '',
    action: decision?.action || ROUTE.REJECT,
    reason: decision?.reason || '',
    risk_level: decision?.assessment?.riskLevel || 'unknown',
    likely_type: decision?.assessment?.likelyType || 'unknown',
    label: decision?.label || '',
    received_at: new Date().toISOString(),
  };
}

export default { ROUTE, normalizeCoverage, findCoverage, routeIncomingCall, buildVoiceTwiml, routeToEvent };
