import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initExtensionHost, HOST_REQUEST, HOST_REQ_CHANNEL, HOST_RES_CHANNEL } from '@/lib/extensionHost';

/**
 * Integration tests for the extension-host security gate (initExtensionHost).
 * These exercise the real postMessage round-trip in jsdom to prove the
 * hardening: secrets require explicit approval, are rate-limited, and need an
 * unlocked vault; saves require confirmation before persisting.
 */
const LOGINS = [{ id: '1', service_name: 'GitHub', service_url: 'https://github.com', username: 'me', password: 's3cret' }];

let unlocked = true;
let approve = true;
const created = [];
const requireApproval = vi.fn(async () => approve);

const client = {
  entities: {
    PasswordEntry: { list: async () => LOGINS, create: async (r) => { created.push(r); return r; } },
    CloakedIdentity: { list: async () => [] },
    TOTPSecret: { list: async () => [{ id: 't1', secret: 'JBSWY3DPEHPK3PXP' }] },
  },
};
const vault = { isUnlocked: () => unlocked };

/** Fire a host request through the real window message path and await the reply. */
function ask(req) {
  return new Promise((resolve) => {
    const reqId = `r${Math.random().toString(36).slice(2)}`;
    const onRes = (e) => {
      if (e.data?.channel === HOST_RES_CHANNEL && e.data.reqId === reqId) {
        window.removeEventListener('message', onRes);
        resolve(e.data.response);
      }
    };
    window.addEventListener('message', onRes);
    window.dispatchEvent(new MessageEvent('message', {
      data: { channel: HOST_REQ_CHANNEL, reqId, ...req },
      origin: window.location.origin,
      source: window,
    }));
  });
}

let teardown;
beforeEach(() => {
  unlocked = true; approve = true; created.length = 0;
  requireApproval.mockClear();
  teardown = initExtensionHost({ client, vault, generateTOTP: async () => '123456', requireApproval });
});
afterEach(() => { if (teardown) teardown(); });

describe('extensionHost gate: secrets require approval', () => {
  it('returns the credential when the user approves', async () => {
    approve = true;
    const res = await ask({ type: HOST_REQUEST.GET_FILL, id: '1' });
    expect(res).toEqual({ ok: true, fill: { username: 'me', password: 's3cret', url: 'https://github.com' } });
    expect(requireApproval).toHaveBeenCalledWith('fill', expect.objectContaining({ id: '1' }));
  });

  it('denies the credential when the user declines', async () => {
    approve = false;
    const res = await ask({ type: HOST_REQUEST.GET_FILL, id: '1' });
    expect(res).toEqual({ ok: false, error: 'denied' });
  });

  it('refuses secrets when the vault is locked (without even prompting)', async () => {
    unlocked = false;
    const res = await ask({ type: HOST_REQUEST.GET_FILL, id: '1' });
    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(requireApproval).not.toHaveBeenCalled();
  });

  it('rate-limits secret requests (anti-enumeration)', async () => {
    let lastErr = null;
    for (let i = 0; i < 12; i++) {
      const res = await ask({ type: HOST_REQUEST.GET_FILL, id: '1' });
      if (!res.ok) lastErr = res.error;
    }
    expect(lastErr).toBe('rate_limited');
  });
});

describe('extensionHost gate: MATCH never needs approval and never leaks secrets', () => {
  it('returns metadata-only matches without prompting', async () => {
    const res = await ask({ type: HOST_REQUEST.MATCH_LOGINS, domain: 'github.com' });
    expect(res.ok).toBe(true);
    expect(res.matches[0]).toMatchObject({ id: '1', username: 'me' });
    expect(JSON.stringify(res.matches)).not.toContain('s3cret');
    expect(requireApproval).not.toHaveBeenCalled();
  });
});

describe('extensionHost gate: SAVE_LOGIN requires confirmation', () => {
  it('persists only after the user confirms', async () => {
    approve = true;
    const res = await ask({ type: HOST_REQUEST.SAVE_LOGIN, payload: { url: 'https://x.com', username: 'u', password: 'p' } });
    expect(res.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ service_url: 'https://x.com', username: 'u', password: 'p' });
  });

  it('does not persist when the user declines', async () => {
    approve = false;
    const res = await ask({ type: HOST_REQUEST.SAVE_LOGIN, payload: { url: 'https://x.com', username: 'u', password: 'p' } });
    expect(res).toEqual({ ok: false, error: 'denied' });
    expect(created).toHaveLength(0);
  });
});
