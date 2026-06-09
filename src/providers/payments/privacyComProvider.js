import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Privacy.com virtual-card provider.
 *
 * Real, fundable virtual cards. Card number / CVV / PIN / billing address are
 * stored encrypted (VirtualCard sensitive-field registry) and only revealed
 * after vault unlock. Never fabricates a usable card number.
 */
export const privacyComProvider = defineProvider({
  id: 'privacy_com',
  displayName: 'Privacy.com',
  description: 'Real merchant-locked / single-use / recurring virtual cards.',
  capabilities: [CAPABILITY.VIRTUAL_CARD, CAPABILITY.CARD_TXN_SYNC],
  requiredSecrets: ['privacy_com_api_key'],
  requiredConsentDataTypes: ['address'],
  limitations: 'US-only. Requires a funded Privacy.com account. Sandbox mode available for testing.',
  setupUrl: 'https://privacy.com/account',
  docsAnchor: 'privacy_com',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    return incognito.functions.invoke(action, payload);
  },
});

export default privacyComProvider;
