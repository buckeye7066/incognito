/**
 * Extension host — the APP side of the browser-extension bridge (companion ext).
 *
 * Architecture & honesty model (see docs/EXTENSION_BRIDGE.md):
 *   - The APP owns the vault. Only the app can match logins to a domain and
 *     decrypt a credential. This module is that authority.
 *   - The EXTENSION owns page interaction (reading the active tab's URL,
 *     injecting into forms) — things a sandboxed web app cannot do.
 *   - The extension therefore asks the app (which must be OPEN and UNLOCKED)
 *     for data. Match requests return METADATA ONLY (never a password); a fill
 *     returns exactly ONE decrypted credential, and only when the vault is
 *     unlocked. The vault key and full vault never cross the boundary.
 *
 * The message handling is split into a PURE `handleHostRequest(request, ctx)`
 * (unit-tested with plain objects) and a thin `initExtensionHost()` that wires
 * it to window.postMessage + the live client/vault.
 */
import { matchLogins } from './domainMatch';

export const HOST_REQ_CHANNEL = 'incognito-host-req';
export const HOST_RES_CHANNEL = 'incognito-host-res';

export const HOST_REQUEST = {
  PING: 'PING',
  MATCH_LOGINS: 'MATCH_LOGINS',
  MATCH_IDENTITIES: 'MATCH_IDENTITIES',
  GET_FILL: 'GET_FILL',
  GET_TOTP: 'GET_TOTP',
  SAVE_LOGIN: 'SAVE_LOGIN',
};

/** Strip a login to safe autofill metadata — explicitly NO secret fields. */
function toLoginMeta(entry, tier) {
  return {
    id: entry.id,
    service_name: entry.service_name || entry.site || '',
    username: entry.username || '',
    url: entry.service_url || entry.url || '',
    tier,
  };
}

function toIdentityMeta(entry, tier) {
  return {
    id: entry.id,
    name: entry.name || entry.full_name || entry.label || '',
    email: entry.email || '',
    url: entry.website || entry.service_url || '',
    tier,
  };
}

/**
 * Pure request handler. Returns a plain response object; never throws for
 * known request types, never includes a secret in a MATCH response.
 *
 * @param {{type:string, domain?:string, id?:string, payload?:object}} request
 * @param {object} ctx
 * @param {boolean} ctx.unlocked            is the vault unlocked?
 * @param {object[]} ctx.logins             PasswordEntry-shaped (decrypted)
 * @param {object[]} [ctx.identities]       CloakedIdentity-shaped
 * @param {(id:string)=>Promise<string|null>} [ctx.getTotp]
 * @param {string} [ctx.version]
 */
export async function handleHostRequest(request, ctx = {}) {
  const type = request?.type;
  const logins = Array.isArray(ctx.logins) ? ctx.logins : [];
  const identities = Array.isArray(ctx.identities) ? ctx.identities : [];

  switch (type) {
    case HOST_REQUEST.PING:
      return { ok: true, version: ctx.version || '0.0.0', unlocked: Boolean(ctx.unlocked) };

    case HOST_REQUEST.MATCH_LOGINS: {
      if (!ctx.unlocked) return { ok: false, error: 'locked', matches: [] };
      const matches = matchLogins(logins, request.domain).map((m) => toLoginMeta(m.entry, m.tier));
      return { ok: true, matches };
    }

    case HOST_REQUEST.MATCH_IDENTITIES: {
      if (!ctx.unlocked) return { ok: false, error: 'locked', matches: [] };
      const matches = matchLogins(identities, request.domain, {}).map((m) => toIdentityMeta(m.entry, m.tier));
      return { ok: true, matches };
    }

    case HOST_REQUEST.GET_FILL: {
      if (!ctx.unlocked) return { ok: false, error: 'locked' };
      const login = logins.find((l) => l.id === request.id);
      if (!login) return { ok: false, error: 'not_found' };
      // Exactly one decrypted credential — the only secret that ever leaves.
      return { ok: true, fill: { username: login.username || '', password: login.password || '', url: login.service_url || login.url || '' } };
    }

    case HOST_REQUEST.GET_TOTP: {
      if (!ctx.unlocked) return { ok: false, error: 'locked' };
      if (typeof ctx.getTotp !== 'function') return { ok: false, error: 'no_totp' };
      const code = await ctx.getTotp(request.id);
      return code ? { ok: true, code } : { ok: false, error: 'no_totp' };
    }

    case HOST_REQUEST.SAVE_LOGIN: {
      const { url = '', username = '', password = '' } = request.payload || {};
      if (!username && !password) return { ok: false, error: 'empty' };
      // The app persists (and encrypts) it — this layer just validates + echoes.
      return { ok: true, save: { url, username, password } };
    }

    default:
      return { ok: false, error: 'unknown_request' };
  }
}

/**
 * Wire the pure handler to the live app. Listens for same-window postMessages
 * from the extension's app-origin content script, answers with live vault data,
 * and persists SAVE_LOGIN through the client. Returns a teardown function.
 *
 * @param {object} deps
 * @param {object} deps.client   the incognito client (entities + generateTOTP)
 * @param {object} deps.vault    vault singleton (isUnlocked())
 * @param {(secret:string)=>Promise<string>} [deps.generateTOTP]
 * @param {string} [deps.version]
 */
export function initExtensionHost({ client, vault, generateTOTP, version = '1.0.0' } = {}) {
  if (typeof window === 'undefined' || !client || !vault) return () => {};

  const respond = (reqId, response) => {
    window.postMessage({ channel: HOST_RES_CHANNEL, reqId, response }, window.location.origin);
  };

  const onMessage = async (event) => {
    // Origin check: only same-window messages from our own origin.
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || msg.channel !== HOST_REQ_CHANNEL || !msg.reqId) return;

    let response;
    try {
      const unlocked = vault.isUnlocked();
      const needData = [HOST_REQUEST.MATCH_LOGINS, HOST_REQUEST.MATCH_IDENTITIES, HOST_REQUEST.GET_FILL].includes(msg.type);
      const ctx = {
        unlocked,
        version,
        logins: unlocked && needData ? await client.entities.PasswordEntry.list() : [],
        identities: unlocked && msg.type === HOST_REQUEST.MATCH_IDENTITIES ? await client.entities.CloakedIdentity.list() : [],
        getTotp: async (id) => {
          const secrets = await client.entities.TOTPSecret.list();
          const s = secrets.find((x) => x.id === id);
          if (!s?.secret || !generateTOTP) return null;
          return generateTOTP(s.secret);
        },
      };
      response = await handleHostRequest(msg, ctx);

      // Persist a captured login on the app side (encrypted by the entity store).
      if (msg.type === HOST_REQUEST.SAVE_LOGIN && response.ok) {
        await client.entities.PasswordEntry.create({
          service_url: response.save.url,
          service_name: response.save.url ? response.save.url.replace(/^https?:\/\//, '').split('/')[0] : 'Saved login',
          username: response.save.username,
          password: response.save.password,
          breach_checked: false,
        });
      }
    } catch (err) {
      response = { ok: false, error: String(err?.message || err) };
    }
    respond(msg.reqId, response);
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

export default { handleHostRequest, initExtensionHost, HOST_REQUEST, HOST_REQ_CHANNEL, HOST_RES_CHANNEL };
