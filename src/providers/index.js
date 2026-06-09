/**
 * Provider registry — the single source of truth the UI consults to answer
 * "can this family actually do X right now, with what, and what's missing?".
 *
 * It composes the declarative providers with REAL runtime context: decrypted
 * API keys (vault), the consent ledger, the optional backend URL, and the
 * native/extension bridges. Settings, Dashboard, System Self-Check, and the
 * feature pages all read from here so capability status is consistent.
 */
import vault from '@/lib/vault';
import { getApiKeys } from '@/api/client.js';
import { isProviderAllowed } from '@/lib/consent';
import { isNativeBridgePresent } from '@/lib/nativeBridge';
import { isExtensionBridgePresent } from '@/lib/extensionBridge';
import {
  CAPABILITY,
  CAPABILITY_STATUS,
  STATUS_META,
  computeProviderStatus,
  bestStatus,
  isUsable,
} from './capabilities.js';

import { mockProvider } from './mockProvider.js';
import { simpleloginProvider } from './email/simpleloginProvider.js';
import { addyProvider } from './email/addyProvider.js';
import { twilioProvider, twilioBackendProvider } from './phone/twilioProvider.js';
import { privacyComProvider } from './payments/privacyComProvider.js';
import { hibpProvider } from './breach/hibpProvider.js';
import { leakcheckProvider } from './breach/leakcheckProvider.js';
import { googleCseProvider } from './search/googleCseProvider.js';
import { openaiCompatibleProvider } from './llm/openaiCompatibleProvider.js';
import { vpnConfigProvider, nativeVpnBridgeProvider } from './vpn/nativeVpnBridgeProvider.js';

export { CAPABILITY, CAPABILITY_STATUS, STATUS_META, isUsable };

const PROVIDERS = [
  simpleloginProvider,
  addyProvider,
  twilioProvider,
  twilioBackendProvider,
  privacyComProvider,
  hibpProvider,
  leakcheckProvider,
  googleCseProvider,
  openaiCompatibleProvider,
  vpnConfigProvider,
  nativeVpnBridgeProvider,
  mockProvider,
];

const REGISTRY = new Map(PROVIDERS.map((p) => [p.id, p]));

// ── Optional self-hosted backend (OFF by default) ──
const BACKEND_KEY = 'incognito_backend_url';
export function getBackendUrl() {
  try { return localStorage.getItem(BACKEND_KEY) || null; } catch { return null; }
}
export function setBackendUrl(url) {
  try {
    if (url) localStorage.setItem(BACKEND_KEY, String(url));
    else localStorage.removeItem(BACKEND_KEY);
  } catch { /* ignore quota */ }
}

/** Gather the live context once for a batch of status computations. */
function buildContext() {
  return {
    keys: getApiKeys(),
    vaultLocked: !vault.isUnlocked(),
    isAllowed: (providerId, dataType) => isProviderAllowed(providerId, dataType),
    hasBackend: Boolean(getBackendUrl()),
    hasNativeBridge: isNativeBridgePresent(),
    hasExtensionBridge: isExtensionBridgePresent(),
  };
}

export function listProviders() {
  return [...REGISTRY.values()];
}

export function getProvider(id) {
  return REGISTRY.get(id) || null;
}

/** Status for one provider, including the honest detail (missing keys etc.). */
export function getProviderStatus(id, ctx = buildContext()) {
  const provider = REGISTRY.get(id);
  if (!provider) {
    return { status: CAPABILITY_STATUS.ERROR, detail: { reason: `unknown provider "${id}"` } };
  }
  const fn = typeof provider.status === 'function' ? provider.status : computeProviderStatus;
  return fn(provider, ctx);
}

/** Map every provider id → { status, detail }. One context, computed once. */
export function getAllProviderStatuses() {
  const ctx = buildContext();
  const out = {};
  for (const p of REGISTRY.values()) out[p.id] = getProviderStatus(p.id, ctx);
  return out;
}

/**
 * Best (most-usable) status for a capability across all providers that offer
 * it, plus the contributing providers so the UI can deep-link to setup.
 */
export function getCapabilityStatus(capability, ctx = buildContext()) {
  const contributors = listProviders().filter((p) => p.capabilities.includes(capability));
  if (contributors.length === 0) {
    return { capability, status: CAPABILITY_STATUS.MANUAL_ONLY, providers: [] };
  }
  const computed = contributors.map((p) => ({ provider: p, ...getProviderStatus(p.id, ctx) }));
  // Ignore the mock provider when deciding the "real" capability status, unless
  // it is the only contributor.
  const real = computed.filter((c) => !c.provider.mockOnly);
  const pool = real.length > 0 ? real : computed;
  return {
    capability,
    status: bestStatus(pool.map((c) => c.status)),
    providers: computed.map((c) => ({
      id: c.provider.id,
      displayName: c.provider.displayName,
      status: c.status,
      detail: c.detail,
      limitations: c.provider.limitations,
      requiresBackend: c.provider.requiresBackend,
      requiresNativeBridge: c.provider.requiresNativeBridge,
      requiresBrowserExtension: c.provider.requiresBrowserExtension,
    })),
  };
}

/** Status for every capability — drives the dashboard capability panel. */
export function getAllCapabilityStatuses() {
  const ctx = buildContext();
  const out = {};
  for (const cap of Object.values(CAPABILITY)) {
    out[cap] = getCapabilityStatus(cap, ctx);
  }
  return out;
}

export default {
  listProviders,
  getProvider,
  getProviderStatus,
  getAllProviderStatuses,
  getCapabilityStatus,
  getAllCapabilityStatuses,
  getBackendUrl,
  setBackendUrl,
};
