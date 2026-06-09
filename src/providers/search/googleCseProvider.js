import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Google Custom Search provider — used to discover where a family member's
 * name / email / phone appears publicly (data-broker discovery, search removal).
 */
export const googleCseProvider = defineProvider({
  id: 'google_search',
  displayName: 'Google Custom Search',
  description: 'Public-web discovery for broker and search-removal workflows.',
  capabilities: [CAPABILITY.SEARCH_DISCOVERY],
  requiredSecrets: ['google_search_api_key', 'google_search_cx'],
  requiredConsentDataTypes: ['name'],
  limitations: 'Discovery only — finds public results. It cannot remove anything; removal is a guided manual workflow.',
  setupUrl: 'https://programmablesearchengine.google.com/',
  docsAnchor: 'google_search',
});

export default googleCseProvider;
