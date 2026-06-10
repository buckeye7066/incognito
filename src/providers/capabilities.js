/**
 * Capability + status model for the private-family build.
 *
 * A "capability" is a thing a family wants to do (create an email alias, screen
 * a call, check a breach…). Most capabilities can only be *fully* delivered by
 * an external provider, an optional self-hosted backend, a native/mobile
 * bridge, or a browser extension. This module gives the whole app one honest
 * vocabulary for "can I actually do this right now, and if not, why?".
 *
 * Design rule: this file is PURE. It imports nothing from the app so it can be
 * unit-tested in isolation and reused on a future backend. The registry
 * (./index.js) injects real context (decrypted keys, consent, bridges).
 *
 * See docs/FEATURE_CAPABILITIES.md.
 */

/** The set of capabilities the app reasons about. */
export const CAPABILITY = {
  EMAIL_ALIAS: 'email_alias',
  EMAIL_INBOX: 'email_inbox',
  PHONE_ALIAS: 'phone_alias',
  SMS_INBOX: 'sms_inbox',
  CALL_SCREEN: 'call_screen',
  CALL_BLOCK: 'call_block',
  VIRTUAL_CARD: 'virtual_card',
  CARD_TXN_SYNC: 'card_txn_sync',
  BREACH_CHECK: 'breach_check',
  DARKWEB_MONITOR: 'darkweb_monitor',
  SEARCH_DISCOVERY: 'search_discovery',
  LLM_ASSIST: 'llm_assist',
  VPN_CONNECT: 'vpn_connect',
  VPN_CONFIG: 'vpn_config',
  AUTOFILL: 'autofill',
};

/**
 * Honest status of a capability/provider. This is the EXACT set the spec
 * enumerates. "vault locked" is represented as a `detail.locked` flag on a
 * `needs_provider` status rather than a new status, so the public vocabulary
 * stays closed.
 */
export const CAPABILITY_STATUS = {
  READY: 'ready',
  NEEDS_PROVIDER: 'needs_provider',
  NEEDS_BACKEND: 'needs_backend',
  NEEDS_NATIVE_BRIDGE: 'needs_native_bridge',
  NEEDS_BROWSER_EXTENSION: 'needs_browser_extension',
  MANUAL_ONLY: 'manual_only',
  MOCK_ONLY: 'mock_only',
  DISABLED: 'disabled',
  ERROR: 'error',
};

/** UI presentation metadata — label + tone for badges. */
export const STATUS_META = {
  [CAPABILITY_STATUS.READY]:                  { label: 'Ready',              tone: 'success' },
  [CAPABILITY_STATUS.NEEDS_PROVIDER]:         { label: 'Needs provider',     tone: 'warning' },
  [CAPABILITY_STATUS.NEEDS_BACKEND]:          { label: 'Needs backend',      tone: 'warning' },
  [CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE]:    { label: 'Needs native app',   tone: 'warning' },
  [CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION]:{ label: 'Needs extension',    tone: 'warning' },
  [CAPABILITY_STATUS.MANUAL_ONLY]:            { label: 'Manual workflow',    tone: 'info' },
  [CAPABILITY_STATUS.MOCK_ONLY]:              { label: 'Demo / mock only',   tone: 'muted' },
  [CAPABILITY_STATUS.DISABLED]:               { label: 'Disabled',           tone: 'muted' },
  [CAPABILITY_STATUS.ERROR]:                  { label: 'Error',              tone: 'danger' },
};

/** A capability is actually usable when it's ready or an honest manual flow. */
export function isUsable(status) {
  return status === CAPABILITY_STATUS.READY || status === CAPABILITY_STATUS.MANUAL_ONLY;
}

/**
 * Pure status computation for a single provider.
 *
 * @param {object} provider  normalized provider (see baseProvider.js)
 * @param {object} ctx
 * @param {Record<string,unknown>} ctx.keys   decrypted API keys ({} if locked)
 * @param {boolean} ctx.vaultLocked            is the vault locked?
 * @param {(providerId:string, dataType?:string)=>boolean} ctx.isAllowed consent check
 * @param {boolean} ctx.hasBackend             is the optional backend configured?
 * @param {boolean} ctx.hasNativeBridge        native bridge present?
 * @param {boolean} ctx.hasExtensionBridge     browser-extension bridge present?
 * @returns {{ status: string, detail: object }}
 */
export function computeProviderStatus(provider, ctx = {}) {
  const {
    keys = {},
    vaultLocked = false,
    isAllowed = () => false,
    hasBackend = false,
    hasNativeBridge = false,
    hasExtensionBridge = false,
  } = ctx;

  if (provider.disabled) {
    return { status: CAPABILITY_STATUS.DISABLED, detail: { reason: 'disabled by user' } };
  }
  if (provider.mockOnly) {
    return { status: CAPABILITY_STATUS.MOCK_ONLY, detail: { reason: 'demo/mock provider' } };
  }

  // Infrastructure prerequisites first — these are independent of the vault.
  if (provider.requiresBrowserExtension && !hasExtensionBridge) {
    return { status: CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION, detail: {} };
  }
  if (provider.requiresNativeBridge && !hasNativeBridge) {
    return { status: CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE, detail: {} };
  }
  if (provider.requiresBackend && !hasBackend) {
    return { status: CAPABILITY_STATUS.NEEDS_BACKEND, detail: {} };
  }

  const needsSecrets = (provider.requiredSecrets || []).length > 0;

  // Secrets live in the encrypted vault. If it's locked we genuinely cannot
  // know whether they're configured — say so honestly instead of guessing.
  if (needsSecrets && vaultLocked) {
    return {
      status: CAPABILITY_STATUS.NEEDS_PROVIDER,
      detail: { locked: true, reason: 'unlock the vault to verify provider keys' },
    };
  }

  const missingSecrets = (provider.requiredSecrets || []).filter((k) => !keys[k]);
  if (missingSecrets.length > 0) {
    return {
      status: CAPABILITY_STATUS.NEEDS_PROVIDER,
      detail: { missingSecrets },
    };
  }

  // Keys present — but outbound calls also need explicit per-data-type consent.
  const missingConsent = (provider.requiredConsentDataTypes || []).filter(
    (dt) => !isAllowed(provider.consentProviderId || provider.id, dt),
  );
  if (missingConsent.length > 0) {
    return {
      status: CAPABILITY_STATUS.NEEDS_PROVIDER,
      detail: { missingConsent, reason: 'consent not granted for these data types' },
    };
  }

  return { status: CAPABILITY_STATUS.READY, detail: {} };
}

/**
 * Reduce several provider statuses into the best (most-usable) status for a
 * capability that multiple providers can satisfy. Order = preference.
 */
const PRIORITY = [
  CAPABILITY_STATUS.READY,
  CAPABILITY_STATUS.MANUAL_ONLY,
  CAPABILITY_STATUS.NEEDS_PROVIDER,
  CAPABILITY_STATUS.NEEDS_BACKEND,
  CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE,
  CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION,
  CAPABILITY_STATUS.MOCK_ONLY,
  CAPABILITY_STATUS.ERROR,
  CAPABILITY_STATUS.DISABLED,
];

export function bestStatus(statuses) {
  if (!statuses || statuses.length === 0) {
    return CAPABILITY_STATUS.MANUAL_ONLY;
  }
  for (const s of PRIORITY) {
    if (statuses.includes(s)) return s;
  }
  return statuses[0];
}
