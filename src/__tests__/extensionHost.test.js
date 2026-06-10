import { describe, it, expect } from 'vitest';
import { handleHostRequest, HOST_REQUEST } from '@/lib/extensionHost';

const LOGINS = [
  { id: '1', service_name: 'GitHub', service_url: 'https://github.com', username: 'me@x.com', password: 's3cret' },
  { id: '2', service_name: 'GitLab', service_url: 'https://gitlab.com', username: 'me', password: 'pw2' },
];

const unlockedCtx = { unlocked: true, version: '1.0.0', logins: LOGINS };
const lockedCtx = { unlocked: false, version: '1.0.0', logins: LOGINS };

describe('extensionHost: handleHostRequest', () => {
  it('PING reports version + unlock state without data', async () => {
    expect(await handleHostRequest({ type: HOST_REQUEST.PING }, lockedCtx))
      .toEqual({ ok: true, version: '1.0.0', unlocked: false });
  });

  it('MATCH_LOGINS returns metadata only — never a password', async () => {
    const res = await handleHostRequest({ type: HOST_REQUEST.MATCH_LOGINS, domain: 'github.com' }, unlockedCtx);
    expect(res.ok).toBe(true);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0]).toMatchObject({ id: '1', username: 'me@x.com' });
    // The security-critical invariant: no secret leaks in a match.
    expect(JSON.stringify(res.matches)).not.toContain('s3cret');
    expect(res.matches[0].password).toBeUndefined();
  });

  it('MATCH_LOGINS refuses when locked', async () => {
    const res = await handleHostRequest({ type: HOST_REQUEST.MATCH_LOGINS, domain: 'github.com' }, lockedCtx);
    expect(res).toEqual({ ok: false, error: 'locked', matches: [] });
  });

  it('GET_FILL returns exactly one decrypted credential when unlocked', async () => {
    const res = await handleHostRequest({ type: HOST_REQUEST.GET_FILL, id: '1' }, unlockedCtx);
    expect(res).toEqual({ ok: true, fill: { username: 'me@x.com', password: 's3cret', url: 'https://github.com' } });
  });

  it('GET_FILL refuses when locked and 404s unknown ids', async () => {
    expect((await handleHostRequest({ type: HOST_REQUEST.GET_FILL, id: '1' }, lockedCtx)).error).toBe('locked');
    expect((await handleHostRequest({ type: HOST_REQUEST.GET_FILL, id: 'nope' }, unlockedCtx)).error).toBe('not_found');
  });

  it('GET_TOTP delegates to ctx.getTotp', async () => {
    const ctx = { ...unlockedCtx, getTotp: async (id) => (id === '1' ? '123456' : null) };
    expect(await handleHostRequest({ type: HOST_REQUEST.GET_TOTP, id: '1' }, ctx)).toEqual({ ok: true, code: '123456' });
    expect((await handleHostRequest({ type: HOST_REQUEST.GET_TOTP, id: '2' }, ctx)).error).toBe('no_totp');
  });

  it('SAVE_LOGIN validates non-empty and echoes for the app to persist', async () => {
    const ok = await handleHostRequest({ type: HOST_REQUEST.SAVE_LOGIN, payload: { url: 'https://x.com', username: 'u', password: 'p' } }, unlockedCtx);
    expect(ok).toEqual({ ok: true, save: { url: 'https://x.com', username: 'u', password: 'p' } });
    expect((await handleHostRequest({ type: HOST_REQUEST.SAVE_LOGIN, payload: {} }, unlockedCtx)).error).toBe('empty');
  });

  it('rejects unknown request types', async () => {
    expect((await handleHostRequest({ type: 'WAT' }, unlockedCtx)).error).toBe('unknown_request');
  });
});
