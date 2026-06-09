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

## Message-body privacy (default: bodies are NOT stored)

Inbound SMS/email **bodies** are sensitive and are governed by
`STORE_MESSAGE_BODIES`:

| Mode | What `events.json` keeps | When to use |
|---|---|---|
| `metadata` (default) | envelope (from/to/subject) + `body_len` only — **never the content** | the safe default |
| `encrypted` | opaque AES-256-GCM blob (`body_enc`) needing `MESSAGE_ENCRYPTION_KEY` | you want bodies but a stolen file must stay unreadable |
| `plaintext` | raw `body` | discouraged; only on a fully-trusted host |

If `encrypted` is set without a usable key, the server **falls back to
metadata-only** rather than storing plaintext.

## Security

- Twilio webhooks are verified with `X-Twilio-Signature` (HMAC-SHA1 over the
  URL + sorted params, keyed by your auth token).
- The email webhook + `/events` require the `X-Incognito-Secret` shared secret.
- Events are capped and stored in `events.json` (swap for SQLite on a VPS).
- Deploy behind HTTPS. Restrict by firewall/VPN to your household if possible.

## Safe deployment on a private family VPS

1. **Lock it down to the household.** Put the server behind your home/VPN
   network, or restrict the firewall to your devices + Twilio's webhook IP
   ranges. There is no auth model for strangers because there are no strangers.
2. **HTTPS only.** Terminate TLS (Caddy/nginx/Cloudflare Tunnel). Twilio
   signature verification uses the exact public URL — set `PUBLIC_BASE_URL` to
   the HTTPS URL Twilio calls.
3. **Secrets in `.env`, never in git.** `.env` is git-ignored. Use a strong
   random `WEBHOOK_SHARED_SECRET` and, if storing bodies, a 32-byte
   `MESSAGE_ENCRYPTION_KEY`.
4. **Default to `metadata`.** Only raise to `encrypted` if you actually need
   message contents; never `plaintext` on a shared/cloud host.
5. **Rotate + prune.** `events.json` is capped at 1000 entries; back it up
   encrypted if you keep it, and rotate the shared secret periodically.
6. **The app works without you.** If the VPS is down, the web app simply shows
   `needs_backend` for SMS inbox / call logs — nothing breaks.
