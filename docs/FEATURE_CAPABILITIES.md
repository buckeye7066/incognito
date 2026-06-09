# Feature Capabilities & Status

Incognito is honest about what it can actually do **right now**. Every
capability resolves to one status, computed by the provider registry
(`src/providers/`) from your decrypted keys, consent ledger, optional backend,
and bridges.

## Status vocabulary

| Status | Meaning | What you do |
|---|---|---|
| `ready` | Works now with what you've configured. | Use it. |
| `needs_provider` | A third-party API key (and consent) is required. | Add the key in Settings → Providers; grant consent. |
| `needs_backend` | Requires the optional self-hosted webhook/scheduler. | See [OPTIONAL_BACKEND.md](./OPTIONAL_BACKEND.md). |
| `needs_native_bridge` | Requires a companion native/mobile app. | See [NATIVE_BRIDGE.md](./NATIVE_BRIDGE.md). |
| `needs_browser_extension` | Requires the companion browser extension. | See [EXTENSION_BRIDGE.md](./EXTENSION_BRIDGE.md). |
| `manual_only` | Honest guided checklist; the app can't automate it. | Follow the steps; track status + evidence. |
| `mock_only` | Demo placeholder; **nothing real happens.** | For trying the UI only. |
| `disabled` | Turned off by you. | Re-enable in Settings. |
| `error` | Misconfigured or a call failed. | Check the detail / audit log. |

> When the vault is **locked**, capabilities that need secrets report
> `needs_provider` with a `locked` flag — the app refuses to guess whether your
> keys are configured. Unlock to see the true status.

## Capability → delivery map

| Capability | Best delivery | Providers / requirement |
|---|---|---|
| `email_alias` | provider, else local placeholder | SimpleLogin, addy.io |
| `phone_alias` | provider | Twilio |
| `sms_inbox` | provider + backend | Twilio + webhook backend |
| `call_screen` | provider + backend (or native) | Twilio + backend |
| `virtual_card` | provider | Privacy.com |
| `card_txn_sync` | provider | Privacy.com |
| `breach_check` | provider, else local breach DB | HIBP, LeakCheck (local DB fallback) |
| `darkweb_monitor` | provider | LeakCheck (scheduled re-checks ≠ live feed) |
| `search_discovery` | provider | Google Custom Search |
| `llm_assist` | provider (redacted data only) | OpenAI-compatible |
| `vpn_config` | local | none — ready offline |
| `vpn_connect` | native | native bridge |
| `autofill` | extension | browser extension |

## Using the registry in code

```js
import { getCapabilityStatus, CAPABILITY, CAPABILITY_STATUS, isUsable }
  from '@/providers';

const cap = getCapabilityStatus(CAPABILITY.EMAIL_ALIAS);
// → { capability, status, providers: [{ id, displayName, status, detail, ... }] }

if (isUsable(cap.status)) {
  // safe to offer the real action
} else {
  // render a CapabilityBadge(cap.status) + a setup link
}
```

`getAllCapabilityStatuses()` returns the full map for the dashboard panel.
`getAllProviderStatuses()` returns per-provider status for Settings.

## Honesty rules enforced here

- The **mock** provider never decides a capability's "real" status unless it's
  the only contributor — so `mock_only` can't masquerade as `ready`.
- A capability with **no** provider is `manual_only`, never a fake `ready`.
- "Monitoring" means scheduled re-checks (local scheduler or backend), not a
  live dark-web feed. "VPN connected" is only ever shown when the native bridge
  confirms it. "Removed" is only shown when manually confirmed or evidenced.
