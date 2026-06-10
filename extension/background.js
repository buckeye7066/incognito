/**
 * Incognito Companion — background service worker (MV3).
 *
 * The coordinator. It never holds vault data; it routes:
 *   - data requests  → an Incognito APP tab (which answers from the unlocked
 *     vault via extensionHost.js), and
 *   - fills/captures  → the SITE tab's content script.
 *
 * The app must be open and unlocked for anything that touches secrets — if no
 * app tab answers, calls fail honestly (the popup tells the user to open it).
 */

const appTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.kind) {
        case 'REGISTER_APP_TAB':
          if (sender.tab?.id != null) appTabs.add(sender.tab.id);
          sendResponse({ ok: true });
          return;

        case 'EXT_CALL':
          sendResponse(await handleAppCall(message.method, message.args || {}));
          return;

        case 'SITE_MATCH': {
          const host = await hostFetch({ type: 'MATCH_LOGINS', domain: message.domain });
          sendResponse(host);
          return;
        }
        case 'SITE_FILL': {
          const host = await hostFetch({ type: 'GET_FILL', id: message.id });
          if (host?.ok && sender.tab?.id != null) {
            await injectIntoTab(sender.tab.id, { kind: 'login', fill: host.fill });
          }
          sendResponse(host);
          return;
        }
        case 'SITE_SAVE': {
          sendResponse(await hostFetch({ type: 'SAVE_LOGIN', payload: message.payload }));
          return;
        }
        default:
          sendResponse({ ok: false, error: 'unknown_message' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true; // keep the channel open for async sendResponse
});

chrome.tabs.onRemoved.addListener((tabId) => appTabs.delete(tabId));

/** App-initiated calls (the window.__INCOGNITO_EXTENSION__ contract). */
async function handleAppCall(method, args) {
  switch (method) {
    case 'getMatchingLogins':
    case 'getMatchingIdentities': {
      const domain = args.domain || (await activeSiteDomain());
      if (!domain) return { ok: false, error: 'No active site to match against', code: 'E_NO_ACTIVE_TAB' };
      const type = method === 'getMatchingLogins' ? 'MATCH_LOGINS' : 'MATCH_IDENTITIES';
      const host = await hostFetch({ type, domain });
      return host?.ok ? { ok: true, result: host.matches } : { ok: false, error: host?.error || 'match failed' };
    }
    case 'fillPassword':
    case 'fillIdentity': {
      const host = await hostFetch({ type: 'GET_FILL', id: args.id });
      if (!host?.ok) return { ok: false, error: host?.error || 'fill unavailable' };
      const tab = await targetSiteTab();
      if (!tab) return { ok: false, error: 'No site tab to fill', code: 'E_NO_ACTIVE_TAB' };
      await injectIntoTab(tab.id, { kind: method === 'fillIdentity' ? 'identity' : 'login', fill: host.fill });
      return { ok: true, result: { filled: true } };
    }
    case 'fillTOTP': {
      const host = await hostFetch({ type: 'GET_TOTP', id: args.id });
      if (!host?.ok) return { ok: false, error: host?.error || 'no totp' };
      const tab = await targetSiteTab();
      if (!tab) return { ok: false, error: 'No site tab to fill', code: 'E_NO_ACTIVE_TAB' };
      await injectIntoTab(tab.id, { kind: 'totp', code: host.code });
      return { ok: true, result: { filled: true } };
    }
    case 'saveDetectedLogin':
      return hostFetch({ type: 'SAVE_LOGIN', payload: args.payload }).then((h) =>
        h?.ok ? { ok: true, result: h.save } : { ok: false, error: h?.error || 'save failed' });
    case 'requestVaultUnlock': {
      const tab = [...appTabs][0];
      if (tab != null) { try { await chrome.tabs.update(tab, { active: true }); } catch { /* ignore */ } }
      return { ok: true, result: { focused: tab != null } };
    }
    default:
      return { ok: false, error: `unknown method ${method}` };
  }
}

/** Ask an app tab for vault data; fail honestly if none is open. */
async function hostFetch(req) {
  const tabId = [...appTabs].pop();
  if (tabId == null) {
    return { ok: false, error: 'Open Incognito and unlock the vault to autofill.', code: 'E_NO_APP_TAB' };
  }
  try {
    return await chrome.tabs.sendMessage(tabId, { kind: 'HOST_FETCH', ...req });
  } catch {
    appTabs.delete(tabId);
    return { ok: false, error: 'Incognito app tab is not responding — reload it.', code: 'E_NO_APP_TAB' };
  }
}

async function injectIntoTab(tabId, payload) {
  try { await chrome.tabs.sendMessage(tabId, { kind: 'INJECT', ...payload }); }
  catch { /* content-site not present on this tab */ }
}

async function activeSiteDomain() {
  const tab = await targetSiteTab();
  if (!tab?.url) return null;
  try { return new URL(tab.url).hostname; } catch { return null; }
}

/** The most recently active normal tab that is NOT an app tab. */
async function targetSiteTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = tabs[0];
  if (active && !appTabs.has(active.id) && /^https?:/.test(active.url || '')) return active;
  const all = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  return all.reverse().find((t) => !appTabs.has(t.id)) || null;
}
