import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * SimpleLogin email-alias provider.
 * Real forwarding aliases. The actual forwarding inbox address is stored
 * encrypted (EmailAlias.actual_email is in the sensitive-field registry).
 */
export const simpleloginProvider = defineProvider({
  id: 'simplelogin',
  displayName: 'SimpleLogin',
  description: 'Real receive/forward email aliases via SimpleLogin.',
  capabilities: [CAPABILITY.EMAIL_ALIAS],
  requiredSecrets: ['simplelogin_api_key'],
  requiredConsentDataTypes: ['email'],
  limitations: 'Receive/forward only from the web app. Sending "as alias" needs SimpleLogin Premium and is best done in their app.',
  setupUrl: 'https://app.simplelogin.io/dashboard/api_key',
  docsAnchor: 'simplelogin',
  async invoke(action, payload = {}) {
    const { default: incognito } = await import('@/api/client.js');
    if (action === 'create') return incognito.functions.invoke('createEmailAliasReal', payload);
    if (action === 'toggle') return incognito.functions.invoke('toggleEmailAlias', payload);
    throw new Error(`simplelogin: unsupported action "${action}"`);
  },
});

export default simpleloginProvider;
