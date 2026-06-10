import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Browser-autofill provider.
 *
 * A sandboxed web app CANNOT read the active tab's URL or inject credentials
 * into a foreign page — that needs the companion browser extension. So autofill
 * is declared as needing a browser extension: when the extension is absent the
 * registry reports NEEDS_BROWSER_EXTENSION (not a false "manual workflow" or a
 * fake "ready"). The in-app autofill PREVIEW still works without it, because
 * matching saved logins to a domain is pure logic (see lib/domainMatch.js); the
 * preview just can't perform the actual fill.
 *
 * See docs/EXTENSION_BRIDGE.md for the message protocol and security model
 * (the extension never receives the master password or decrypted secrets except
 * the single item being filled, after an explicit user gesture).
 */
export const autofillBridgeProvider = defineProvider({
  id: 'autofill_bridge',
  displayName: 'Browser autofill bridge',
  description: 'Autofill saved logins, identities, and TOTP codes on web pages via the companion extension.',
  capabilities: [CAPABILITY.AUTOFILL],
  requiresBrowserExtension: true,
  limitations:
    'Requires the Incognito companion browser extension. Without it, the app can preview which ' +
    'logins match a site but cannot fill them — browsers forbid a web page from reading another ' +
    "tab's URL or typing into it.",
  docsAnchor: 'extension_bridge',
});

export default autofillBridgeProvider;
