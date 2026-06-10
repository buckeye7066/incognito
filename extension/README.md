# Incognito Companion (browser extension)

The companion extension that does the one thing a sandboxed web app cannot:
read the active tab's domain and fill credentials into a page. The **vault never
lives in the extension** — it stays in the Incognito app, which must be open and
unlocked for any fill.

## Install — local-only build

This build trusts only the local app origins (`http://localhost:5173` dev,
`http://localhost:4173` preview). There is no public/hosted origin.

### Easiest: the launcher (Windows)

Run **`launch.bat`** in the repo root (or the desktop shortcut). It starts the
app and opens Chrome/Edge in a dedicated, isolated profile with this extension
already loaded — no manual steps. (Implemented by `open-incognito-browser.ps1`.)

### Manual (any OS)

1. `npm run dev` (app on `:5173`) — or `npm run build && npm run preview` (`:4173`).
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer
   mode**, click **Load unpacked**, and select this `extension/` folder.
3. Open the app at `http://localhost:5173`, unlock the vault, and the AUTOFILL
   capability flips to **Ready**.

> If you later host the app, add that exact origin to **three** places in
> `manifest.json` (the `content-app.js` match, the `content-site.js`
> `exclude_matches`, and `web_accessible_resources`). Never use a wildcard
> subdomain — see Security hardening below.

## How it works

```
 ┌─ Incognito app tab ────────────┐         ┌─ background.js (service worker) ─┐
 │ inpage.js  window.__INCOGNITO_ │  call   │  routes data ↔ fills, holds no   │
 │   EXTENSION__  (MAIN world)    │◄───────►│  secrets                          │
 │ content-app.js (courier)       │         └──────────────┬───────────────────┘
 │ extensionHost.js  ← VAULT here │                        │ inject one item
 └────────────────────────────────┘                        ▼
                                              ┌─ any site tab ─────────────┐
                                              │ content-site.js: find form,│
                                              │ fill, capture on submit     │
                                              └─────────────────────────────┘
```

- **Match** requests return metadata only (service, username, URL) — never a
  password.
- A **fill** causes the app to decrypt exactly one credential and hand the
  background just that, which forwards it to the site tab's content script.
- All page↔app messages are same-origin checked; the extension talks only to the
  Incognito app origin and the tab it's filling.
- If no app tab is open/unlocked, calls fail honestly: *"Open Incognito and
  unlock the vault to autofill."*

The app side of this contract is `src/lib/extensionBridge.js` (app → extension)
and `src/lib/extensionHost.js` (extension → app vault). See
`docs/EXTENSION_BRIDGE.md`.

## Security hardening

- **One canonical origin, no wildcards.** `manifest.json` lists the exact app
  origin(s) only — never `*.vercel.app`, so another Vercel site can't pose as
  the app and request vault data. Replace `https://incognito-app.vercel.app`
  with your real production origin in all three spots.
- **Explicit approval for every secret.** The app never serves a credential
  (`GET_FILL`/`GET_TOTP`) or saves a captured login silently — it shows an
  in-app confirmation (`FillApprovalGate`). A hidden same-origin script that
  tries to enumerate the vault gets a denial, not data. Secret requests are also
  rate-limited and require the vault unlocked.
- **Domain-matched fills only.** The background refuses to inject a credential
  into a tab whose domain doesn't match the credential's stored URL
  (confused-deputy guard).
- **Deploy with a strict CSP** on the app origin (no third-party `script-src`,
  no `unsafe-inline`) so the only code that can drive the bridge is the app's own.

## Files

| File | Context | Role |
|---|---|---|
| `manifest.json` | — | MV3 manifest; lists app origins. |
| `inpage.js` | app, MAIN | Defines `window.__INCOGNITO_EXTENSION__`. |
| `content-app.js` | app, ISOLATED | Courier between page and background. |
| `content-site.js` | sites, ISOLATED | Form detect / fill / capture. |
| `background.js` | service worker | Coordinator + router. |
| `popup.html` / `popup.js` | popup | Matches for the current tab. |
