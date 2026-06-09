# Optional Self-Hosted Backend

**Status: planned, OFF by default.** Incognito is fully usable without it, with
reduced capabilities. The backend exists only for things a browser cannot
receive or schedule:

- Inbound SMS **inbox** and **call logs** (Twilio POSTs to a webhook).
- **Live call screening** decisions (TwiML responses).
- Inbound **email** events for alias inboxes (provider webhooks).
- **Scheduled** monitoring re-checks (cron) when the app isn't open.

## Non-negotiable rules

- **One household only.** No public signup, no multi-tenant database, no public
  API for strangers.
- **No plaintext vault storage.** The backend stores the *minimum* webhook/event
  metadata, ideally as encrypted opaque payloads the client decrypts.
- **Validate webhook signatures** where the provider supports them (e.g. Twilio
  `X-Twilio-Signature`).
- **No real secrets in source.** Ship `.env.example`; never `.env`.
- The frontend must keep working when the backend is unreachable.

## Planned layout

```
server/
  README.md            # run locally or on a private VPS
  .env.example         # TWILIO_AUTH_TOKEN=, WEBHOOK_SHARED_SECRET=, ...
  src/index.js         # tiny HTTP server, signature verification
  src/twilioWebhook.js # inbound SMS / voice → encrypted event store
  src/emailWebhook.js  # alias inbound email events
  src/scheduler.js     # periodic monitoring re-checks
```

## Wiring it to the app

Set the backend URL in Settings (stored under `incognito_backend_url`). The
provider registry then flips backend-dependent capabilities
(`sms_inbox`, `call_screen`) from `needs_backend` to `needs_provider`/`ready`.
Leaving it blank keeps everything local.
