/**
 * Protection-coverage summary for the dashboard (Pass 16).
 *
 * The app reasons about "capabilities" (email alias, call screen, virtual card…)
 * and each has an honest live status (ready / needs provider / needs backend /
 * needs extension / manual / mock / disabled). The dashboard never surfaced any
 * of this — a family had no at-a-glance answer to "what actually works right
 * now, and what do I still need to set up?".
 *
 * This module turns the capability-status map into that answer. It is PURE
 * (only depends on the pure capabilities vocabulary) so it is unit-testable with
 * a plain object and never fabricates readiness — a capability counts as covered
 * only when its real status says so.
 */
import { CAPABILITY, CAPABILITY_STATUS, isUsable, STATUS_META } from '@/providers/capabilities';

/** Friendly label + the page where a family sets each capability up. */
export const CAPABILITY_META = {
  [CAPABILITY.EMAIL_ALIAS]: { label: 'Email aliases', page: 'EmailAliases' },
  [CAPABILITY.EMAIL_INBOX]: { label: 'Alias inbox', page: 'EmailAliases' },
  [CAPABILITY.PHONE_ALIAS]: { label: 'Phone aliases', page: 'PhoneAliases' },
  [CAPABILITY.SMS_INBOX]: { label: 'SMS inbox', page: 'PhoneAliases' },
  [CAPABILITY.CALL_SCREEN]: { label: 'Call screening', page: 'CallGuard' },
  [CAPABILITY.CALL_BLOCK]: { label: 'Call blocking (native)', page: 'CallGuard' },
  [CAPABILITY.CALL_ROUTING]: { label: 'Family call coverage', page: 'CallGuard' },
  [CAPABILITY.VIRTUAL_CARD]: { label: 'Virtual cards', page: 'CloakedPay' },
  [CAPABILITY.CARD_TXN_SYNC]: { label: 'Card transactions', page: 'CloakedPay' },
  [CAPABILITY.BREACH_CHECK]: { label: 'Breach checks', page: 'PasswordChecker' },
  [CAPABILITY.DARKWEB_MONITOR]: { label: 'Dark-web monitoring', page: 'MonitoringHub' },
  [CAPABILITY.SEARCH_DISCOVERY]: { label: 'Exposure discovery', page: 'Scans' },
  [CAPABILITY.LLM_ASSIST]: { label: 'AI assistant', page: 'Settings' },
  [CAPABILITY.VPN_CONNECT]: { label: 'VPN connection', page: 'VPNManager' },
  [CAPABILITY.VPN_CONFIG]: { label: 'VPN config manager', page: 'VPNManager' },
  [CAPABILITY.AUTOFILL]: { label: 'Browser autofill', page: 'PasswordManager' },
};

/**
 * Sort order for "what should I set up next" — surface the things that are one
 * concrete step away from working before mock/disabled placeholders.
 */
const ACTION_PRIORITY = {
  [CAPABILITY_STATUS.NEEDS_PROVIDER]: 0,
  [CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION]: 1,
  [CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE]: 2,
  [CAPABILITY_STATUS.NEEDS_BACKEND]: 3,
  [CAPABILITY_STATUS.ERROR]: 4,
  [CAPABILITY_STATUS.MOCK_ONLY]: 5,
  [CAPABILITY_STATUS.DISABLED]: 6,
};

/**
 * @param {Record<string, {status:string}>} capabilities  map from useCapabilities()
 * @param {object} [meta]  capability → { label, page }
 * @returns {{
 *   total:number, ready:number, usable:number, needsSetup:number,
 *   coveragePct:number, byStatus:Record<string,number>,
 *   topActions:Array<{capability,status,label,page,statusLabel}>
 * }}
 */
export function summarizeCoverage(capabilities = {}, meta = CAPABILITY_META) {
  const entries = Object.entries(capabilities).filter(([, c]) => c && c.status);
  const byStatus = {};
  let ready = 0;
  let usable = 0;

  for (const [, cap] of entries) {
    byStatus[cap.status] = (byStatus[cap.status] || 0) + 1;
    if (cap.status === CAPABILITY_STATUS.READY) ready++;
    if (isUsable(cap.status)) usable++;
  }

  const total = entries.length;
  const coveragePct = total ? Math.round((usable / total) * 100) : 0;

  const topActions = entries
    .filter(([, cap]) => !isUsable(cap.status) && cap.status !== CAPABILITY_STATUS.DISABLED)
    .map(([capability, cap]) => ({
      capability,
      status: cap.status,
      label: meta[capability]?.label || capability,
      page: meta[capability]?.page || null,
      statusLabel: STATUS_META[cap.status]?.label || cap.status,
    }))
    .sort((a, b) => {
      const pa = ACTION_PRIORITY[a.status] ?? 99;
      const pb = ACTION_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label);
    });

  return {
    total,
    ready,
    usable,
    needsSetup: total - usable,
    coveragePct,
    byStatus,
    topActions,
  };
}

export default { summarizeCoverage, CAPABILITY_META };
