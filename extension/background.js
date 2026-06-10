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
            // Defense-in-depth: never inject a credential whose stored domain
            // contradicts the tab we'd type it into.
            if (domainMismatch(host.fill?.url, sender.tab.url)) {
              sendResponse({ ok: false, error: 'Credential domain does not match this site.', code: 'E_DOMAIN_MISMATCH' });
              return;
            }
            await injectIntoTab(sender.tab.id, { kind: 'login', fill: host.fill });
          }
          sendResponse(host);
          return;
        }
        case 'SITE_SAVE': {
          // Bind the save URL to the REAL tab origin, not content-script payload,
          // so a hostile page can't attribute a capture to another site.
          const url = tabOrigin(sender.tab?.url) || message.payload?.url || '';
          sendResponse(await hostFetch({ type: 'SAVE_LOGIN', payload: { ...message.payload, url } }));
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
      // Refuse to fill a credential into a tab whose domain it doesn't belong to
      // (confused-deputy guard — the target tab is chosen heuristically).
      if (domainMismatch(host.fill?.url, tab.url)) {
        return { ok: false, error: 'Active tab domain does not match this credential.', code: 'E_DOMAIN_MISMATCH' };
      }
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

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
function tabOrigin(u) {
  try { return new URL(u).origin; } catch { return ''; }
}
// Compact registrable-domain collapse (mirrors src/lib/domainMatch.js intent;
// extension can't import app modules, so a small inline copy lives here).
const MULTI_SUFFIX = new Set(['co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br', 'com.mx', 'github.io', 'pages.dev']);
function registrable(host) {
  if (!host || !host.includes('.')) return host;
  const l = host.split('.');
  const last2 = l.slice(-2).join('.');
  return l.length >= 3 && MULTI_SUFFIX.has(last2) ? l.slice(-3).join('.') : last2;
}
/** True only on a POSITIVE mismatch (both hosts known and different sites). */
function domainMismatch(credUrl, tabUrl) {
  const a = hostOf(credUrl);
  const b = hostOf(tabUrl);
  if (!a || !b) return false; // can't verify (e.g. urlless credential) → don't block
  if (a === b) return false;
  return registrable(a) !== registrable(b);
}

/** The most recently active normal tab that is NOT an app tab. */
async function targetSiteTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = tabs[0];
  if (active && !appTabs.has(active.id) && /^https?:/.test(active.url || '')) return active;
  const all = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  return all.reverse().find((t) => !appTabs.has(t.id)) || null;
}
