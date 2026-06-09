/**
 * Browser-extension bridge contract.
 *
 * True autofill (reading the active tab's domain, injecting credentials into
 * a page) is impossible from a sandboxed web app — it requires a companion
 * browser extension. This module defines the contract and detects whether the
 * extension is present. When it is absent, every method rejects with a typed
 * E_NO_EXTENSION error so the UI can show "extension bridge not installed"
 * instead of pretending autofill works.
 *
 * The extension, when installed, injects `window.__INCOGNITO_EXTENSION__`
 * implementing the methods below. See docs/EXTENSION_BRIDGE.md for the full
 * message protocol and security model (the extension never receives the
 * master password or decrypted secrets except for the single item being
 * filled, after an explicit user gesture).
 */

const GLOBAL = '__INCOGNITO_EXTENSION__';

export function getExtension() {
  if (typeof window === 'undefined') return null;
  return window[GLOBAL] || null;
}

export function isExtensionBridgePresent() {
  const ext = getExtension();
  return Boolean(ext && typeof ext.version === 'string');
}

function noExtension(method) {
  const err = new Error(
    `Browser extension not installed — "${method}" is unavailable. ` +
    `Install the Incognito companion extension to enable autofill.`,
  );
  err.code = 'E_NO_EXTENSION';
  return err;
}

async function call(method, ...args) {
  const ext = getExtension();
  if (!ext || typeof ext[method] !== 'function') {
    throw noExtension(method);
  }
  return ext[method](...args);
}

// ── Contract (mirrors docs/EXTENSION_BRIDGE.md) ──
export const extensionBridge = {
  isPresent: isExtensionBridgePresent,
  getMatchingLogins: (domain) => call('getMatchingLogins', domain),
  getMatchingIdentities: (domain) => call('getMatchingIdentities', domain),
  fillPassword: (id) => call('fillPassword', id),
  fillIdentity: (id) => call('fillIdentity', id),
  fillTOTP: (id) => call('fillTOTP', id),
  saveDetectedLogin: (payload) => call('saveDetectedLogin', payload),
  createIdentityFromSignupPage: (payload) => call('createIdentityFromSignupPage', payload),
  requestVaultUnlock: () => call('requestVaultUnlock'),
};

export default extensionBridge;
