import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * addy.io email-alias provider. Same capability shape as SimpleLogin.
 */
export const addyProvider = defineProvider({
  id: 'addy',
  displayName: 'addy.io',
  description: 'Real receive/forward email aliases via addy.io.',
  capabilities: [CAPABILITY.EMAIL_ALIAS],
  requiredSecrets: ['addy_api_key'],
  requiredConsentDataTypes: ['email'],
  limitations: 'Receive/forward only from the web app. Reply/send-as-alias depends on your addy.io plan.',
  setupUrl: 'https://app.addy.io/settings/api',
  docsAnchor: 'addy',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    if (action === 'create') return incognito.functions.invoke('createEmailAliasReal', payload);
    if (action === 'toggle') return incognito.functions.invoke('toggleEmailAlias', payload);
    throw new Error(`addy: unsupported action "${action}"`);
  },
});

export default addyProvider;
