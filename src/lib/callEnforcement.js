/**
 * Call enforcement — bridges an on-device screening decision to the native
 * dialer, honestly (Pass: native bridge).
 *
 * The web app can only ADVISE on a caller (see lib/callScreening.js). Actually
 * blocking/allowing a live call, or letting the OS screen it, needs the
 * companion native shell's dialer access (window.__INCOGNITO_NATIVE__ → call.*).
 * This module decides what can really be enforced vs. what stays advisory, and
 * folds the OS's own call events into the app log so the history reflects what
 * actually happened on the device — never a claim the app couldn't back up.
 *
 * Pure (only reuses normalizePhone + the ACTION vocabulary) so the policy is
 * unit-testable without a bridge.
 */
import { normalizePhone } from './phoneRules';
import { ACTION } from './callScreening';

export const ENFORCEMENT = { ENFORCED: 'enforced', ADVISORY: 'advisory' };

/**
 * Given a decided action and whether native screening is available, decide what
 * actually happens. Safety rule preserved from callScreening: a SCREEN decision
 * is never auto-dropped — it surfaces for review even with a bridge present.
 *
 * @param {string} action  'block' | 'allow' | 'screen'
 * @param {{ hasBridge?: boolean, canScreen?: boolean }} [native]
 * @returns {{ mode:string, command:?string, note:string }}
 */
export function planEnforcement(action, { hasBridge = false, canScreen = false } = {}) {
  const canEnforce = Boolean(hasBridge && canScreen);
  if (!canEnforce) {
    return {
      mode: ENFORCEMENT.ADVISORY,
      command: null,
      note: 'Advisory only — install the companion app to block or allow calls on this device.',
    };
  }
  switch (action) {
    case ACTION.BLOCK:
      return { mode: ENFORCEMENT.ENFORCED, command: 'block', note: 'Blocked on this device.' };
    case ACTION.ALLOW:
      return { mode: ENFORCEMENT.ENFORCED, command: 'allow', note: 'Allowed through.' };
    case ACTION.SCREEN:
    default:
      // Never silently drop a screened call, even when we could.
      return { mode: ENFORCEMENT.ADVISORY, command: null, note: 'Screened for your review (not blocked).' };
  }
}

function normalizeEvent(e, source) {
  return {
    number: normalizePhone(e.caller_number || e.number || ''),
    at: e.screened_at || e.at || e.timestamp || null,
    action: e.action_taken || e.action || 'unknown',
    source,
    raw: e,
  };
}

/**
 * Merge the OS's call events with the app's own log. Native events are
 * authoritative for what actually happened on the device, so on a collision
 * (same number + timestamp) the native record wins. Returns newest-first.
 */
export function mergeCallEvents(appLogs = [], nativeEvents = []) {
  const nat = (Array.isArray(nativeEvents) ? nativeEvents : []).map((e) => normalizeEvent(e, 'native'));
  const app = (Array.isArray(appLogs) ? appLogs : []).map((e) => normalizeEvent(e, 'app'));
  const seen = new Set();
  const out = [];
  for (const ev of [...nat, ...app]) { // native first → wins on dedupe
    const key = `${ev.number}|${ev.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
}

/** Tally a merged event list for honest stats (incl. how many the OS enforced). */
export function summarizeEnforcement(events = []) {
  const acc = { blocked: 0, allowed: 0, screened: 0, enforcedOnDevice: 0 };
  for (const e of Array.isArray(events) ? events : []) {
    if (e.action === 'block') acc.blocked++;
    else if (e.action === 'allow') acc.allowed++;
    else if (e.action === 'screen') acc.screened++;
    if (e.source === 'native') acc.enforcedOnDevice++;
  }
  return acc;
}

export default { ENFORCEMENT, planEnforcement, mergeCallEvents, summarizeEnforcement };
