# Provider Setup (Private Family)

All provider keys are **optional**. Incognito runs local-first without them;
providers unlock the capabilities that cannot exist purely locally. Every key
is stored **encrypted at rest** in the vault, and every outbound call requires
**explicit per-data-type consent** (Settings → Providers / Consent) and is
recorded in the audit log.

> Add keys only while the vault is **unlocked**. Keys are never written in
> plaintext and never committed to source.

| Provider | Capability | Keys (api-key field names) | Consent data type | Get a key |
|---|---|---|---|---|
| SimpleLogin | email aliases | `simplelogin_api_key` | `email` | https://app.simplelogin.io/dashboard/api_key |
| addy.io | email aliases | `addy_api_key` | `email` | https://app.addy.io/settings/api |
| Twilio | phone aliases, SMS, call | `twilio_account_sid`, `twilio_auth_token` | `phone` | https://console.twilio.com/ |
| Privacy.com | virtual cards | `privacy_com_api_key` (+ `privacy_com_sandbox`) | `address` | https://privacy.com/account |
| Have I Been Pwned | exact breach check | `hibp_api_key` | `email` | https://haveibeenpwned.com/API/Key |
| LeakCheck.io | breach / dark-web | `leakcheck_api_key` | `email` | https://leakcheck.io/ |
| Google Custom Search | discovery | `google_search_api_key`, `google_search_cx` | `name` | https://programmablesearchengine.google.com/ |
| OpenAI-compatible | AI assistant | `openai_api_key` (+ `openai_model`) | `profile_summary` | https://platform.openai.com/api-keys |

## What works WITHOUT any provider

- Vault, passwords, TOTP, identities (local placeholders), profiles.
- Local breach-database matching (breach **check**, not live dark-web monitoring).
- VPN config manager + IP/DNS leak checks (not VPN connect).
- All guided/manual workflows (broker opt-outs, Google removal, FTC Do-Not-Call,
  recovery checklists) with evidence capture.

## Costs & limits (be realistic)

- **Twilio / Privacy.com** can incur real charges (held numbers, card funding).
- **HIBP** is rate-limited; **LeakCheck** free tier is on-demand only.
- Providers' own terms apply; Incognito only calls them with your consent.

## Optional backend

Inbound SMS, call logs, live call screening, and scheduled monitoring need the
optional self-hosted webhook server — **off by default**. See
[OPTIONAL_BACKEND.md](./OPTIONAL_BACKEND.md).
