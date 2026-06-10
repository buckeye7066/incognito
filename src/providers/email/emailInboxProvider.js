import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Email alias INBOX provider.
 *
 * Receiving and listing the messages sent to an alias requires the alias
 * provider to POST inbound-email events to the optional self-hosted backend
 * (see server/ + docs/OPTIONAL_BACKEND.md). Without that backend the web app
 * can create/forward aliases but cannot show an inbox — so this capability is
 * honestly `needs_backend` until the backend URL + shared secret are set.
 *
 * The web app never sends mail "as alias" on its own; compose/reply is a
 * provider-premium/backend feature, so aliases are "receive/forward only" here.
 */
export const emailInboxProvider = defineProvider({
  id: 'email_inbox',
  displayName: 'Alias inbox (self-hosted backend)',
  description: 'List messages received by an alias via the optional webhook backend.',
  capabilities: [CAPABILITY.EMAIL_INBOX],
  requiresBackend: true,
  limitations: 'Receive/forward only. Reading an inbox needs the optional backend; sending “as alias” needs provider premium and is not done from the web app.',
  docsAnchor: 'optional-backend',
});

export default emailInboxProvider;
