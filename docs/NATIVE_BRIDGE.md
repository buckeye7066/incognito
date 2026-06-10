# Native / Mobile Bridge

Some capabilities need OS-level access a browser cannot have (system VPN,
OS call screening). A companion native shell (Capacitor / Tauri / Electron)
provides them by injecting `window.__INCOGNITO_NATIVE__`.

Contract: `src/lib/nativeBridge.js`. When present it exposes
`platform: string` and `invoke(command, payload)`. Absent that, calls reject
with `code === 'E_NO_NATIVE_BRIDGE'` and the UI shows the honest reduced state.

## Commands

| Command | Purpose |
|---|---|
| `vpn.status` | Current VPN connection state (truthful — see below). |
| `vpn.connect` | Connect to a location. |
| `vpn.disconnect` | Disconnect. |
| `vpn.listLocations` | Available server locations. |

The app **never** displays "VPN connected" unless `vpn.status` from the bridge
confirms it. See [NATIVE_VPN_BRIDGE.md](./NATIVE_VPN_BRIDGE.md).

### Call screening / dialer (`call.*`)

| Command | Purpose |
|---|---|
| `call.canScreen` | Whether the OS has granted call-screening permission. |
| `call.recentEvents` | Recent call events the OS actually saw (number, time, action). |
| `call.block` | Block a number on the device. |
| `call.allow` | Allow / whitelist a number. |
| `call.report` | Record a verdict for a number (block/allow/screen). |

Call Guard always **advises** from on-device signals (`lib/callScreening.js`).
Actually blocking or allowing a live call is `CALL_BLOCK`, which needs these
commands — absent the bridge the UI says blocking is advisory only and never
claims a call was blocked. A SCREEN decision is never auto-dropped; only
explicit block/allow are enforced. Only phone numbers and an opaque verdict
cross the bridge — no vault secrets. See `lib/callEnforcement.js`.

## Security model

- The bridge runs with the user's OS privileges; it performs only the explicit
  commands above and returns status, never silent background actions.
- No vault secrets cross the bridge for VPN/call commands — only opaque config
  identifiers the native side already holds.
