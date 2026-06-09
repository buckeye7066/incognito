import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Have I Been Pwned breach-check provider.
 *
 * With a key, returns exact breach hits. Without a key the app still runs a
 * LOCAL breach-database match (see breachDatabase.js) — that is breach_check,
 * NOT live dark-web monitoring, and the UI must not conflate them.
 */
export const hibpProvider = defineProvider({
  id: 'hibp',
  displayName: 'Have I Been Pwned',
  description: 'Email breach lookups (exact, with API key).',
  capabilities: [CAPABILITY.BREACH_CHECK],
  requiredSecrets: ['hibp_api_key'],
  requiredConsentDataTypes: ['email'],
  limitations: 'Breach lookup only — not continuous dark-web monitoring. Rate-limited.',
  setupUrl: 'https://haveibeenpwned.com/API/Key',
  docsAnchor: 'hibp',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    if (action === 'check') return incognito.functions.invoke('checkHIBP', payload);
    if (action === 'checkBreaches') return incognito.functions.invoke('checkBreaches', payload);
    throw new Error(`hibp: unsupported action "${action}"`);
  },
});

export default hibpProvider;
