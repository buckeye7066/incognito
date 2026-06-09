import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * LeakCheck.io breach / leaked-credential provider.
 *
 * The closest the app gets to "dark-web monitoring", and only with a key. A
 * free public endpoint is used as a fallback for breach_check. Real continuous
 * dark-web monitoring is a paid provider feature — never claimed without one.
 */
export const leakcheckProvider = defineProvider({
  id: 'leakcheck',
  displayName: 'LeakCheck.io',
  description: 'Leaked-credential / breach lookups by email or username.',
  capabilities: [CAPABILITY.BREACH_CHECK, CAPABILITY.DARKWEB_MONITOR],
  requiredSecrets: ['leakcheck_api_key'],
  requiredConsentDataTypes: ['email'],
  limitations: 'On-demand lookups. "Monitoring" means scheduled re-checks (local scheduler or optional backend), not a live dark-web feed.',
  setupUrl: 'https://leakcheck.io/',
  docsAnchor: 'leakcheck',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    if (action === 'checkBreaches') return incognito.functions.invoke('checkBreaches', payload);
    throw new Error(`leakcheck: unsupported action "${action}"`);
  },
});

export default leakcheckProvider;
