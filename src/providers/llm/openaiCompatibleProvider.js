import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * OpenAI-compatible LLM provider for the AI privacy assistant.
 *
 * Privacy rule: only REDACTED / summarized data is sent, and only after the
 * user approves a per-call preview. The assistant proposes local tasks; it
 * never executes external actions and never receives passwords, SSNs, card
 * data, full DOB, children's sensitive data, or private notes.
 */
export const openaiCompatibleProvider = defineProvider({
  id: 'openai',
  displayName: 'OpenAI-compatible LLM',
  description: 'Drafts emails/checklists and explains risk — on redacted data only.',
  capabilities: [CAPABILITY.LLM_ASSIST],
  requiredSecrets: ['openai_api_key'],
  requiredConsentDataTypes: ['profile_summary'],
  limitations: 'Receives redacted summaries only, after an explicit per-call preview + consent. Suggestions create local tasks; nothing is sent or changed automatically.',
  setupUrl: 'https://platform.openai.com/api-keys',
  docsAnchor: 'openai',
  async invoke(action, payload = {}) {
    const { incognito } = await import('@/api/client.js');
    if (action === 'invokeLLM') return incognito.integrations.Core.InvokeLLM(payload);
    throw new Error(`openai: unsupported action "${action}"`);
  },
});

export default openaiCompatibleProvider;
