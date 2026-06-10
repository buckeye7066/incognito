# Incognito Companion (browser extension)

The companion extension that does the one thing a sandboxed web app cannot:
read the active tab's domain and fill credentials into a page. The **vault never
lives in the extension** — it stays in the Incognito app, which must be open and
unlocked for any fill.

## Install (unpacked, for development)

1. Build/serve the Incognito app and note its origin (e.g. `http://localhost:5173`).
2. If your app origin isn't already listed, add it to **three** places in
   `manifest.json`: the `content_scripts` match for `content-app.js`, the
   matching `exclude_matches` for `content-site.js`, and `web_accessible_resources`.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select this `extension/` folder. (Edge: `edge://extensions`.)

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

## Files

| File | Context | Role |
|---|---|---|
| `manifest.json` | — | MV3 manifest; lists app origins. |
| `inpage.js` | app, MAIN | Defines `window.__INCOGNITO_EXTENSION__`. |
| `content-app.js` | app, ISOLATED | Courier between page and background. |
| `content-site.js` | sites, ISOLATED | Form detect / fill / capture. |
| `background.js` | service worker | Coordinator + router. |
| `popup.html` / `popup.js` | popup | Matches for the current tab. |
