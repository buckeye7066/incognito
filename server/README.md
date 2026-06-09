# Incognito Optional Backend (private family, OFF by default)

This tiny server exists ONLY for things a browser cannot do: receive inbound
Twilio SMS/voice webhooks, receive alias email-provider webhooks, and run
scheduled monitoring re-checks. The Incognito web app works fully without it,
with reduced capabilities (`needs_backend`).

**This is for one household. There is no signup, no multi-tenant DB, no public
API.** It stores the *minimum* event metadata and, where possible, encrypted
opaque payloads the client decrypts. Never put vault secrets or real provider
secrets in source — use `.env` (copy from `.env.example`).

## Run locally

```bash
cd server
cp .env.example .env        # fill in your values
node src/index.js           # listens on PORT (default 8787)
```

Then in the app: Settings → set the backend URL to `http://localhost:8787`
(or your private VPS URL behind HTTPS). Leaving it blank keeps everything local.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | liveness probe |
| `POST` | `/webhooks/twilio/sms` | inbound SMS → event store (Twilio-signed) |
| `POST` | `/webhooks/twilio/voice` | inbound call → screening response (Twilio-signed) |
| `POST` | `/webhooks/email` | alias inbound email events (shared-secret) |
| `GET`  | `/events?since=` | poll stored events (shared-secret header) |

## Security

- Twilio webhooks are verified with `X-Twilio-Signature` (HMAC-SHA1 over the
  URL + sorted params, keyed by your auth token).
- The email webhook + `/events` require the `X-Incognito-Secret` shared secret.
- Events are capped and stored in `events.json` (swap for SQLite on a VPS).
- Deploy behind HTTPS. Restrict by firewall/VPN to your household if possible.
