/**
 * Incognito Companion — in-page bridge (MAIN world, Incognito app origin only).
 *
 * Defines `window.__INCOGNITO_EXTENSION__`, the object the app's
 * src/lib/extensionBridge.js detects and calls. Each method is a thin RPC: it
 * posts an `incognito-ext-call` to the app-origin content script (content-app.js)
 * and resolves when the matching `incognito-ext-reply` comes back.
 *
 * This script holds NO vault data and performs NO page injection itself — it is
 * purely the app's handle to the extension's cross-tab powers.
 */
(function () {
  'use strict';
  if (window.__INCOGNITO_EXTENSION__) return;

  const CALL = 'incognito-ext-call';
  const REPLY = 'incognito-ext-reply';
  const pending = new Map();
  let seq = 0;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== REPLY || !pending.has(msg.callId)) return;
    const { resolve, reject } = pending.get(msg.callId);
    pending.delete(msg.callId);
    if (msg.ok) resolve(msg.result);
    else {
      const err = new Error(msg.error || 'Extension call failed');
      err.code = msg.code || 'E_EXTENSION';
      reject(err);
    }
  });

  function rpc(method, args) {
    return new Promise((resolve, reject) => {
      const callId = `c${++seq}`;
      pending.set(callId, { resolve, reject });
      window.postMessage({ channel: CALL, callId, method, args }, window.location.origin);
      // Safety timeout so a never-answered call doesn't leak a pending promise.
      setTimeout(() => {
        if (pending.has(callId)) {
          pending.delete(callId);
          const err = new Error('Extension did not respond');
          err.code = 'E_EXTENSION_TIMEOUT';
          reject(err);
        }
      }, 15000);
    });
  }

  window.__INCOGNITO_EXTENSION__ = {
    version: '1.0.0',
    getMatchingLogins: (domain) => rpc('getMatchingLogins', { domain }),
    getMatchingIdentities: (domain) => rpc('getMatchingIdentities', { domain }),
    fillPassword: (id) => rpc('fillPassword', { id }),
    fillIdentity: (id) => rpc('fillIdentity', { id }),
    fillTOTP: (id) => rpc('fillTOTP', { id }),
    saveDetectedLogin: (payload) => rpc('saveDetectedLogin', { payload }),
    createIdentityFromSignupPage: (payload) => rpc('createIdentityFromSignupPage', { payload }),
    requestVaultUnlock: () => rpc('requestVaultUnlock', {}),
  };

  // Let the app know the bridge just appeared (it may have rendered already).
  window.dispatchEvent(new CustomEvent('incognito:extension-ready'));
})();
