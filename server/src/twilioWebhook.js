/**
 * Twilio inbound webhook handlers + signature verification.
 *
 * Signature scheme (Twilio): HMAC-SHA1 over (full URL + each POST param sorted
 * by key and concatenated as key+value), keyed by the account auth token,
 * base64-encoded, compared to the X-Twilio-Signature header.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import crypto from 'node:crypto';
import { bodyFields } from './storage.js';

export function verifyTwilioSignature({ authToken, url, params, signature }) {
  if (!authToken || !signature) return false;
  const sorted = Object.keys(params || {}).sort();
  let data = url;
  for (const k of sorted) data += k + params[k];
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Normalize an inbound SMS into a stored event. The message BODY is handled per
 * the storage policy (default: metadata only — the body is NOT persisted).
 * @param {object} params Twilio POST params
 * @param {{ mode?: string, encrypt?: Function }} [storeOpts]
 */
export function smsToEvent(params, storeOpts = {}) {
  return {
    type: 'sms_inbound',
    from: params.From || '',
    to: params.To || '',
    sid: params.MessageSid || '',
    received_at: new Date().toISOString(),
    ...bodyFields(params.Body, storeOpts),
  };
}

/** Minimal TwiML response for an inbound call (screening hook point). */
export function voiceScreeningTwiml({ message = 'This number does not accept unscreened calls. Please state your name after the tone.' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Record maxLength="30"/></Response>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ));
}
