/**
 * Demo / mock provider.
 *
 * Exists so the app can be explored offline WITHOUT pretending anything real
 * happened. Its status is always `mock_only`, and everything it returns is
 * clearly flagged `mock: true`. It must NEVER be used to claim a real alias,
 * card, removal, or call was created.
 */
import { defineProvider } from './baseProvider.js';
import { CAPABILITY } from './capabilities.js';

export const mockProvider = defineProvider({
  id: 'mock',
  displayName: 'Demo (mock)',
  description: 'Local placeholders for trying the UI. Nothing real is created or sent.',
  capabilities: [
    CAPABILITY.EMAIL_ALIAS,
    CAPABILITY.PHONE_ALIAS,
    CAPABILITY.VIRTUAL_CARD,
  ],
  mockOnly: true,
  limitations: 'Generates clearly-labelled placeholders only. No real aliases, numbers, or cards.',
  async testConnection() {
    return { ok: true, mock: true, message: 'Mock provider is always available (no real effects).' };
  },
  async invoke(action, payload = {}) {
    return {
      mock: true,
      action,
      note: 'Mock provider — no real-world effect. Configure a real provider to enable this.',
      payload,
    };
  },
});

export default mockProvider;
