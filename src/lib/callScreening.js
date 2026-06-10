/**
 * Call screening — LOCAL, checkable signals only (Pass 12).
 *
 * Honesty first: no consumer app has a live, authoritative database of "who is
 * a scammer", and an LLM is guessing if it claims one. So this module scores a
 * caller ONLY on signals we can actually verify on-device:
 *   - is the number in the family's contacts (allow) or block list?
 *   - is the caller ID a valid North-American number at all?
 *   - is it "neighbor spoofing" — faking your own area code + prefix to look local?
 *   - is it a toll-free number (often, not always, telemarketing)?
 *   - has this number called repeatedly in recent history?
 *
 * Each signal is returned explicitly so the UI can SHOW its reasoning instead
 * of asserting an unverifiable verdict. Actually intercepting / dropping a live
 * call needs the carrier (Twilio) or a native dialer bridge — see CALL_SCREEN
 * capability. This lib decides *intent* (block / screen / allow); enforcement
 * is a separate, capability-gated concern.
 *
 * Pure + dependency-light (only reuses normalizePhone). Unit-tested in isolation.
 */
import { normalizePhone } from './phoneRules.js';

export const RISK = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
export const ACTION = { BLOCK: 'block', SCREEN: 'screen', ALLOW: 'allow' };

const TOLL_FREE_AREA_CODES = new Set(['800', '888', '877', '866', '855', '844', '833']);

/** Severity weights let us combine signals into one risk level deterministically. */
const SEVERITY_WEIGHT = { danger: 3, warn: 2, info: 1, good: -3 };

/**
 * Is `number` a structurally valid North-American (NANP) number?
 * NANP: 10 digits; area code and exchange must each start 2-9; not all-identical.
 */
export function isPlausibleNanp(number) {
  const n = normalizePhone(number);
  if (n.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(n)) return false;        // 0000000000, 1111111111…
  if (!/^[2-9]/.test(n)) return false;            // area code can't start 0/1
  if (!/^[2-9]/.test(n.slice(3))) return false;   // exchange can't start 0/1
  return true;
}

export function isTollFree(number) {
  const n = normalizePhone(number);
  return n.length === 10 && TOLL_FREE_AREA_CODES.has(n.slice(0, 3));
}

/**
 * "Neighbor spoofing": a caller faking your own area code + 3-digit exchange
 * (first 6 digits) so the call looks like a local neighbor. Classic scam tactic.
 * Only flagged when it is NOT actually your own line and NOT a known contact.
 */
export function isNeighborSpoof(number, myNumber) {
  const caller = normalizePhone(number);
  const mine = normalizePhone(myNumber);
  if (caller.length !== 10 || mine.length !== 10) return false;
  if (caller === mine) return false;
  return caller.slice(0, 6) === mine.slice(0, 6);
}

function inList(list, number) {
  const n = normalizePhone(number);
  if (!n) return false;
  return (Array.isArray(list) ? list : []).map(normalizePhone).includes(n);
}

/**
 * Assess a caller from verifiable signals.
 *
 * @param {object} ctx
 * @param {string}   ctx.number        the caller ID to assess
 * @param {string}  [ctx.myNumber]     the family's own line (for spoof detection)
 * @param {string[]}[ctx.contacts]     known/trusted numbers (allowlist)
 * @param {string[]}[ctx.blocked]      explicitly blocked numbers
 * @param {string[]}[ctx.history]      recent caller numbers (repeat-call detection)
 * @returns {{ riskLevel:string, likelyType:string, signals:Array<{code,label,severity}>, basis:string }}
 */
export function assessCaller({ number, myNumber, contacts = [], blocked = [], history = [] } = {}) {
  const signals = [];
  const add = (code, label, severity) => signals.push({ code, label, severity });
  const n = normalizePhone(number);

  if (!n) {
    return {
      riskLevel: RISK.MEDIUM,
      likelyType: 'unknown',
      signals: [{ code: 'no_caller_id', label: 'No / withheld caller ID', severity: 'warn' }],
      basis: 'signals',
    };
  }

  const blocklisted = inList(blocked, n);
  const trusted = inList(contacts, n);

  if (trusted) add('contact', 'In your contacts', 'good');
  if (blocklisted) add('blocked', 'On your block list', 'danger');
  if (!isPlausibleNanp(n) && !isTollFree(n)) add('invalid_format', 'Invalid / impossible caller ID', 'danger');
  if (isNeighborSpoof(n, myNumber) && !trusted) add('neighbor_spoof', 'Matches your local prefix (possible spoof)', 'danger');
  if (isTollFree(n) && !trusted) add('toll_free', 'Toll-free number (often marketing)', 'info');

  const repeats = (Array.isArray(history) ? history : []).map(normalizePhone).filter((h) => h === n).length;
  if (repeats >= 3 && !trusted) add('repeat_caller', `Called ${repeats}× recently`, 'warn');

  // Combine: a single trusted "good" signal short-circuits to low risk.
  const score = signals.reduce((s, x) => s + (SEVERITY_WEIGHT[x.severity] || 0), 0);
  let riskLevel;
  if (trusted && !blocklisted) riskLevel = RISK.LOW;
  else if (score >= 3) riskLevel = RISK.HIGH;
  else if (score >= 1) riskLevel = RISK.MEDIUM;
  else riskLevel = RISK.LOW;

  let likelyType = 'unknown';
  if (trusted) likelyType = 'legitimate';
  else if (signals.some((s) => s.code === 'neighbor_spoof' || s.code === 'invalid_format')) likelyType = 'scam';
  else if (signals.some((s) => s.code === 'toll_free')) likelyType = 'telemarketer';

  return { riskLevel, likelyType, signals, basis: 'signals' };
}

/**
 * Map an assessment + the family's settings to an intended action.
 * Allow always wins for trusted contacts; auto-block only fires on HIGH risk
 * when the family has opted in, otherwise high/medium risk is screened (not
 * silently dropped) so a real call is never lost without review.
 *
 * @param {ReturnType<typeof assessCaller>} assessment
 * @param {{ autoBlockHighRisk?: boolean }} [settings]
 */
export function decideAction(assessment, { autoBlockHighRisk = false } = {}) {
  if (!assessment) return ACTION.SCREEN;
  if (assessment.signals?.some((s) => s.code === 'contact')) return ACTION.ALLOW;
  if (assessment.signals?.some((s) => s.code === 'blocked')) return ACTION.BLOCK;
  if (assessment.riskLevel === RISK.HIGH) return autoBlockHighRisk ? ACTION.BLOCK : ACTION.SCREEN;
  if (assessment.riskLevel === RISK.MEDIUM) return ACTION.SCREEN;
  return ACTION.ALLOW;
}

/** One-line human summary of why an action was chosen — for the UI/log. */
export function explainAssessment(assessment) {
  if (!assessment?.signals?.length) return 'No notable signals.';
  return assessment.signals.map((s) => s.label).join(' · ');
}

export default { isPlausibleNanp, isTollFree, isNeighborSpoof, assessCaller, decideAction, explainAssessment, RISK, ACTION };
