/**
 * Incognito Companion — app-origin content script (ISOLATED world).
 *
 * Runs only on the Incognito app origin. Two jobs:
 *   1. Inject inpage.js (the window.__INCOGNITO_EXTENSION__ bridge) into MAIN.
 *   2. Be the COURIER between the page and the extension background:
 *        - app → ext : forward `incognito-ext-call` from inpage to background.
 *        - ext → app : when background needs vault data, post an
 *          `incognito-host-req` to the page (answered by src/lib/extensionHost.js)
 *          and return the `incognito-host-res` to background.
 *
 * It never reads vault data itself — it only relays messages the page chooses
 * to answer, all on the app's own origin.
 */
(function () {
  'use strict';

  // 1. Inject the in-page bridge into the MAIN world.
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inpage.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[incognito-ext] failed to inject inpage bridge', e);
  }

  // Register this tab as an app tab so background can route host fetches here.
  chrome.runtime.sendMessage({ kind: 'REGISTER_APP_TAB' });

  // 2a. app → ext : forward inpage RPCs to background, reply back to the page.
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || msg.channel !== 'incognito-ext-call') return;
    chrome.runtime.sendMessage(
      { kind: 'EXT_CALL', method: msg.method, args: msg.args },
      (resp) => {
        const r = resp || { ok: false, error: 'No response from extension' };
        window.postMessage(
          { channel: 'incognito-ext-reply', callId: msg.callId, ok: r.ok, result: r.result, error: r.error, code: r.code },
          window.location.origin,
        );
      },
    );
  });

  // 2b. ext → app : background asks us to fetch vault data from the page host.
  const hostWaiters = new Map();
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || msg.channel !== 'incognito-host-res' || !hostWaiters.has(msg.reqId)) return;
    const done = hostWaiters.get(msg.reqId);
    hostWaiters.delete(msg.reqId);
    done(msg.response);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.kind !== 'HOST_FETCH') return false;
    const reqId = `h${Date.now()}_${Math.floor(performance.now())}`;
    const timer = setTimeout(() => {
      if (hostWaiters.has(reqId)) { hostWaiters.delete(reqId); sendResponse({ ok: false, error: 'host timeout' }); }
    }, 12000);
    hostWaiters.set(reqId, (response) => { clearTimeout(timer); sendResponse(response); });
    window.postMessage({ channel: 'incognito-host-req', reqId, type: message.type, domain: message.domain, id: message.id, payload: message.payload }, window.location.origin);
    return true; // async sendResponse
  });
})();
