import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyTwilioSignature, smsToEvent, voiceScreeningTwiml } from '../../server/src/twilioWebhook.js';
import { verifyEmailWebhook, emailToEvent } from '../../server/src/emailWebhook.js';
import { dueMonitors } from '../../server/src/scheduler.js';
import { makeEncryptor, bodyFields } from '../../server/src/storage.js';
import { redactForLLM } from '@/lib/aiRedaction';

describe('optional backend: Twilio signature verification', () => {
  const authToken = 'test_auth_token';
  const url = 'https://example.com/webhooks/twilio/sms';
  const params = { To: '+15550001111', From: '+15552223333', Body: 'hello' };

  function sign(p) {
    let data = url;
    for (const k of Object.keys(p).sort()) data += k + p[k];
    return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  }

  it('accepts a valid signature and rejects a bad one', () => {
    const sig = sign(params);
    expect(verifyTwilioSignature({ authToken, url, params, signature: sig })).toBe(true);
    expect(verifyTwilioSignature({ authToken, url, params, signature: 'wrong' })).toBe(false);
    // tampered params → different signature → rejected
    expect(verifyTwilioSignature({ authToken, url, params: { ...params, Body: 'evil' }, signature: sig })).toBe(false);
  });

  it('voice screening TwiML escapes content', () => {
    expect(voiceScreeningTwiml({ message: 'a<b' })).toContain('a&lt;b');
  });
});

describe('optional backend: message-body storage policy', () => {
  const secretBody = 'meet me at 123 Main Street, code 4321';

  it('DEFAULT (metadata) never persists the SMS body', () => {
    const e = smsToEvent({ From: '+1', To: '+2', Body: secretBody, MessageSid: 'SM1' });
    expect(e.body).toBeUndefined();
    expect(e.body_enc).toBeUndefined();
    expect(e.body_len).toBe(secretBody.length);
    expect(JSON.stringify(e)).not.toContain('123 Main Street');
    // envelope metadata is still present
    expect(e).toMatchObject({ type: 'sms_inbound', from: '+1', sid: 'SM1' });
  });

  it('DEFAULT never persists the email body', () => {
    const e = emailToEvent({ alias: 'a@x.io', from: 'b@y.io', subject: 'hi', body: secretBody });
    expect(e.body).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain('123 Main Street');
  });

  it('encrypted mode stores an opaque blob, not plaintext', () => {
    const encrypt = makeEncryptor('a'.repeat(64));
    const e = smsToEvent({ Body: secretBody }, { mode: 'encrypted', encrypt });
    expect(e.body).toBeUndefined();
    expect(e.body_enc).toMatchObject({ alg: 'aes-256-gcm', iv: expect.any(String), ct: expect.any(String) });
    expect(JSON.stringify(e)).not.toContain('123 Main Street');
  });

  it('encrypted mode without a key falls back to metadata (never plaintext)', () => {
    const fields = bodyFields(secretBody, { mode: 'encrypted', encrypt: null });
    expect(fields.body).toBeUndefined();
    expect(fields.body_enc).toBeUndefined();
    expect(fields.body_len).toBe(secretBody.length);
  });

  it('plaintext mode is explicit opt-in only', () => {
    const e = smsToEvent({ Body: secretBody }, { mode: 'plaintext' });
    expect(e.body).toBe(secretBody);
  });
});

describe('optional backend: email webhook + scheduler', () => {
  it('verifies the shared secret in constant time', () => {
    expect(verifyEmailWebhook('s3cret', 's3cret')).toBe(true);
    expect(verifyEmailWebhook('nope', 's3cret')).toBe(false);
    expect(verifyEmailWebhook('', 's3cret')).toBe(false);
  });
  it('normalizes inbound email', () => {
    expect(emailToEvent({ alias: 'a@x.io', from: 'b@y.io', subject: 'hi' }))
      .toMatchObject({ type: 'email_inbound', alias: 'a@x.io' });
  });
  it('dueMonitors picks only overdue monitors', () => {
    const now = 1_000_000_000_000;
    const day = 24 * 60 * 60 * 1000;
    const monitors = [
      { id: 'a', last_run_at: new Date(now - 2 * day).toISOString() },
      { id: 'b', last_run_at: new Date(now - 1000).toISOString() },
    ];
    const due = dueMonitors(monitors, now, day);
    expect(due.map((m) => m.id)).toEqual(['a']);
  });
});

describe('live LLM path redaction (redactForLLM)', () => {
  const sample = 'ssn 123-45-6789, card 4111 1111 1111 1111, dob 01/02/1990, a@b.com, 555-123-4567, 123 Main Street';

  it('by DEFAULT redacts SSN/card/DOB/email/phone/address', () => {
    const out = redactForLLM(sample);
    expect(out).toContain('[SSN]');
    expect(out).toContain('[CARD]');
    expect(out).toContain('[DOB]');
    expect(out).toContain('[EMAIL]');
    expect(out).toContain('[PHONE]');
    expect(out).toContain('[ADDRESS]');
    expect(out).not.toContain('123-45-6789');
    expect(out).not.toContain('a@b.com');
    expect(out).not.toContain('555-123-4567');
    expect(out).not.toContain('123 Main Street');
  });

  it('allowlist exception preserves only the allowed type', () => {
    const out = redactForLLM(sample, { allow: ['phone'] });
    expect(out).toContain('555-123-4567'); // explicitly allowed
    expect(out).toContain('[SSN]');        // everything else still redacted
    expect(out).toContain('[EMAIL]');
  });

  it('redacts supplied child/dependent names', () => {
    const out = redactForLLM('call Timmy at home', { names: ['Timmy'] });
    expect(out).toContain('[NAME]');
    expect(out).not.toContain('Timmy');
  });
});
