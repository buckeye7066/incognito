/**
 * Base provider contract for the private-family build.
 *
 * Every integration declares WHAT it can do and WHAT it needs, rather than
 * hiding that behind a button that silently fails. The actual HTTP for most
 * providers already lives (consent-gated + audited) in src/api/client.js — a
 * provider here is the honest, declarative face of that: capabilities,
 * requirements, a status() the UI can render, and a thin testConnection()/
 * invoke() that delegates to the existing client functions.
 *
 * Required shape (per spec):
 *   id, displayName, capabilities, requiredSecrets, requiredConsentDataTypes,
 *   requiresBackend, requiresNativeBridge, requiresBrowserExtension,
 *   status(), testConnection(), invoke()
 */

/**
 * Normalize a provider spec, filling defaults so the registry and UI can rely
 * on every field existing.
 * @param {object} spec
 * @returns {object} normalized provider
 */
export function defineProvider(spec) {
  if (!spec || !spec.id) {
    throw new Error('defineProvider requires an { id }');
  }
  return {
    id: spec.id,
    displayName: spec.displayName || spec.id,
    description: spec.description || '',
    // Which docs/FEATURE_CAPABILITIES.md capabilities this provider satisfies.
    capabilities: spec.capabilities || [],
    // localStorage api-key field names that must be present (encrypted at rest).
    requiredSecrets: spec.requiredSecrets || [],
    // consent.js data types that must be granted before any outbound call.
    requiredConsentDataTypes: spec.requiredConsentDataTypes || [],
    // The id used in the consent ledger, if different from `id`.
    consentProviderId: spec.consentProviderId || spec.id,
    requiresBackend: Boolean(spec.requiresBackend),
    requiresNativeBridge: Boolean(spec.requiresNativeBridge),
    requiresBrowserExtension: Boolean(spec.requiresBrowserExtension),
    // True for the demo provider only — never claims real-world effects.
    mockOnly: Boolean(spec.mockOnly),
    disabled: Boolean(spec.disabled),
    // Free-text honesty note shown in the UI (e.g. "receive/forward only").
    limitations: spec.limitations || '',
    // Where the user configures it.
    setupUrl: spec.setupUrl || '',
    docsAnchor: spec.docsAnchor || '',

    /**
     * status(ctx) — defaults to the shared pure computation. Providers rarely
     * override this; the registry passes real ctx.
     */
    status: spec.status,

    /**
     * testConnection() — a lightweight, consent-gated probe. Default refuses
     * honestly instead of faking success. Concrete providers override.
     */
    testConnection:
      spec.testConnection ||
      (async () => ({
        ok: false,
        message: `${spec.displayName || spec.id} has no connection test; configure keys and use the feature page.`,
      })),

    /**
     * invoke(action, payload) — routes to the real client function. Default
     * throws so an unimplemented action can never silently no-op.
     */
    invoke:
      spec.invoke ||
      (async (action) => {
        throw new Error(`Provider "${spec.id}" does not implement action "${action}"`);
      }),
  };
}
