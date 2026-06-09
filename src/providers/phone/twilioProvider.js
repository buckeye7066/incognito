import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Twilio phone-alias / call-screening provider.
 *
 * Number search/purchase work from the web app with Twilio credentials.
 * Inbound SMS inbox, call logs, and real-time call screening need Twilio to
 * POST to a webhook — i.e. the OPTIONAL self-hosted backend. Those capabilities
 * therefore declare requiresBackend so the UI shows "needs backend" honestly.
 * Forwarding numbers are stored encrypted (PhoneAlias.actual_phone).
 */
export const twilioProvider = defineProvider({
  id: 'twilio',
  displayName: 'Twilio',
  description: 'Real phone numbers for aliases, SMS, and call screening.',
  capabilities: [CAPABILITY.PHONE_ALIAS],
  requiredSecrets: ['twilio_account_sid', 'twilio_auth_token'],
  requiredConsentDataTypes: ['phone'],
  limitations: 'Buying/holding numbers has a monthly cost. Inbound SMS inbox + call logs + live screening require the optional self-hosted webhook backend.',
  setupUrl: 'https://console.twilio.com/',
  docsAnchor: 'twilio',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    // Delegate to client functions where they exist; unknown actions surface
    // an honest error rather than a fake success.
    return incognito.functions.invoke(action, payload);
  },
});

/**
 * Backend-dependent Twilio capabilities, surfaced as a distinct provider so the
 * dashboard can show "phone alias = ready" while "SMS inbox = needs backend".
 */
export const twilioBackendProvider = defineProvider({
  id: 'twilio_backend',
  displayName: 'Twilio + self-hosted webhook',
  description: 'Inbound SMS inbox, call logs, and live call screening.',
  capabilities: [CAPABILITY.SMS_INBOX, CAPABILITY.CALL_SCREEN],
  consentProviderId: 'twilio',
  requiredSecrets: ['twilio_account_sid', 'twilio_auth_token'],
  requiredConsentDataTypes: ['phone'],
  requiresBackend: true,
  limitations: 'Requires the optional server/ webhook receiver. See docs/OPTIONAL_BACKEND.md.',
  docsAnchor: 'twilio',
});

export default twilioProvider;
