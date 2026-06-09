/**
 * Email alias inbound webhook helpers (shared-secret authenticated).
 *
 * Alias providers (or a mail forwarder) POST inbound-email events here. We keep
 * only minimal metadata; bodies should be sent already-redacted or stored as an
 * encrypted opaque blob the client decrypts.
 */
import crypto from 'node:crypto';
import { bodyFields } from './storage.js';

export function verifyEmailWebhook(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Normalize an inbound email into a stored event. The email BODY is handled per
 * the storage policy (default: metadata only). Subject + envelope are retained
 * as routing metadata; if your subjects carry sensitive content, run the backend
 * in 'encrypted' mode.
 * @param {object} params
 * @param {{ mode?: string, encrypt?: Function }} [storeOpts]
 */
export function emailToEvent(params, storeOpts = {}) {
  return {
    type: 'email_inbound',
    alias: params.alias || params.to || '',
    from: params.from || '',
    subject: params.subject || '',
    received_at: new Date().toISOString(),
    ...bodyFields(params.body, storeOpts),
  };
}
