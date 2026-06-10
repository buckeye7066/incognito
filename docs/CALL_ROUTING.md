# Central call coverage (you + family)

The **only** way to screen calls for several different people from one place.
Device-level screening (a native app or Tasker) only covers the phone it's
installed on. Central coverage works because screening happens at the **network
layer**: each covered person publishes a Twilio number that rings *through* to
their real phone only after the backend approves the caller.

## Topology (no forwarding loop)

```
 caller dials the PUBLISHED Twilio number
        │
        ▼
 Twilio  ──POST /webhooks/twilio/voice──►  backend (server/)
        ◄────────────── TwiML ──────────── routeIncomingCall() decides:
        │                                    • allow  → <Dial> the real phone
        │                                    • block  → <Reject>
        │                                    • screen → record name / voicemail
        ▼
 real phone rings (only on allow)
```

Each covered person gets a coverage entry:

```json
{
  "twilioNumber": "+16145550100",   // the number they hand out (calls hit Twilio)
  "label": "Mom",
  "forwardTo":   "+16145550199",    // their REAL phone, dialed only when allowed
  "contacts":    ["+12025551111"],  // always-allow
  "blocked":     ["+13035558888"],  // always-reject
  "policy": { "autoBlockHighRisk": true, "voicemailOnScreen": false, "record": false }
}
```

> **Why two numbers per person?** The real phone must **not** forward to Twilio,
> or you get an infinite loop. Instead each person *publishes* the Twilio number;
> it screens, then dials their real line. The real line has no forwarding.

The decision logic is the same on-device brain used everywhere
(`src/lib/callScreening.js` → `src/lib/callRouting.js`), so a number that screens
as a scam by the app's rules is rejected here too.

## What the app/backend can and can't do

| Can (automated) | Can't (you do it once, in the real world) |
|---|---|
| Receive each call, decide, log it (metadata only), ring the real phone | Create the Twilio account + buy a number per person |
| Apply allow/block lists + risk policy per number | Make people use the published Twilio number |
| Expose a synced coverage list + an event log to verify | Reach a **local** backend from Twilio without a public tunnel |

## Setup

1. **Twilio:** create an account, buy one number **per covered person**.
2. **Run the backend** (`server/`): set `TWILIO_AUTH_TOKEN`, `WEBHOOK_SHARED_SECRET`,
   and `PUBLIC_BASE_URL`. See `server/README.md` / `server/.env.example`.
3. **Expose it to Twilio.** Because the app is local-only, the backend needs a
   public URL Twilio can POST to — a tunnel (`cloudflared tunnel`, `ngrok http 8787`)
   or a tiny always-on host. Set `PUBLIC_BASE_URL` to that exact URL (the
   signature check uses it).
4. **Point each Twilio number's Voice webhook** at `PUBLIC_BASE_URL/webhooks/twilio/voice`
   (HTTP POST).
5. **Set coverage.** POST the JSON array above to `/coverage` with the
   `x-incognito-secret` header, or drop a `coverage.json` next to the server.

## Verify it works

1. `curl https://YOUR_TUNNEL/health` → `{"ok":true}`.
2. From a phone **not** in `contacts`, call a covered Twilio number.
   - With `autoBlockHighRisk` + a spoof/invalid caller → you hear it rejected.
   - From a number in `contacts` → your real phone rings.
3. Pull the log: `curl -H "x-incognito-secret: <secret>" https://YOUR_TUNNEL/events`
   — you'll see a `call_routed` event with `action`, `reason`, `risk_level`
   (numbers + verdict only; **no recording or audio** is stored).

If the badge on the Call Guard page still says **"Needs backend"**, the app
isn't pointed at a reachable backend yet — that's the honest signal nothing is
being routed.

## Privacy

Only phone numbers + an opaque verdict cross the backend. Recordings are made by
Twilio (under your account) only when `record`/voicemail is chosen; the backend
log stores **metadata only** (never audio). No vault secrets are involved.
