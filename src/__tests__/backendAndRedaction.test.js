import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyTwilioSignature, smsToEvent, voiceScreeningTwiml } from '../../server/src/twilioWebhook.js';
import { verifyEmailWebhook, emailToEvent } from '../../server/src/emailWebhook.js';
import { dueMonitors } from '../../server/src/scheduler.js';
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

  it('normalizes an SMS to a minimal event', () => {
    const e = smsToEvent({ From: '+1', To: '+2', Body: 'hi', MessageSid: 'SM1' });
    expect(e).toMatchObject({ type: 'sms_inbound', from: '+1', to: '+2', body: 'hi', sid: 'SM1' });
  });

  it('voice screening TwiML escapes content', () => {
    expect(voiceScreeningTwiml({ message: 'a<b' })).toContain('a&lt;b');
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
  it('strips SSN/card/DOB but leaves phone (call screening needs it)', () => {
    const out = redactForLLM('ssn 123-45-6789, card 4111 1111 1111 1111, dob 01/02/1990, call 555-123-4567');
    expect(out).toContain('[SSN]');
    expect(out).toContain('[CARD]');
    expect(out).toContain('[DOB]');
    expect(out).toContain('555-123-4567'); // phone NOT redacted by the forbidden-subset
    expect(out).not.toContain('123-45-6789');
  });
});
