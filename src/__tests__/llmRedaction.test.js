import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setProviderEnabled, setDataTypeConsent } from '@/lib/consent';

// Fresh client so the singleton vault tracks cleared localStorage.
async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}

function fakeOpenAI(capture) {
  return async (url, opts) => {
    capture.body = opts?.body || '';
    capture.url = url;
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      text: async () => '',
    };
  };
}

describe('invokeLLM live-path redaction (hard guarantee)', () => {
  let client, vault, originalFetch;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
    await client.setApiKeys({ openai_api_key: 'sk-test' });
    setProviderEnabled('openai', true);
    setDataTypeConsent('openai', 'profile_summary', true);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => { globalThis.fetch = originalFetch; });

  it('cannot send SSN/card/DOB/email/phone/address in the outbound request', async () => {
    const cap = {};
    globalThis.fetch = fakeOpenAI(cap);
    const prompt =
      'SSN 123-45-6789, card 4111 1111 1111 1111, dob 01/02/1990, ' +
      'email a@b.com, phone 555-123-4567, home 123 Main Street';
    await client.default.integrations.Core.InvokeLLM({ prompt });

    expect(cap.url).toContain('api.openai.com');
    for (const leak of ['123-45-6789', '4111 1111 1111 1111', '01/02/1990', 'a@b.com', '555-123-4567', '123 Main Street']) {
      expect(cap.body).not.toContain(leak);
    }
    expect(cap.body).toContain('[SSN]');
    expect(cap.body).toContain('[ADDRESS]');
  });

  it('redacts child/dependent member names gathered from the household', async () => {
    await client.default.entities.HouseholdMember.create({ display_name: 'Timmy', role: 'child' });
    const cap = {};
    globalThis.fetch = fakeOpenAI(cap);
    await client.default.integrations.Core.InvokeLLM({ prompt: 'Help plan a party for Timmy' });
    expect(cap.body).not.toContain('Timmy');
    expect(cap.body).toContain('[NAME]');
  });

  it('honors an explicit allowlist (caller-risk screening keeps the phone)', async () => {
    const cap = {};
    globalThis.fetch = fakeOpenAI(cap);
    await client.default.integrations.Core.InvokeLLM({ prompt: 'risk for 555-123-4567', allow: ['phone'] });
    expect(cap.body).toContain('555-123-4567');
  });
});
