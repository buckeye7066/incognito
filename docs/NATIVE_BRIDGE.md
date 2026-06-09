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

## Security model

- The bridge runs with the user's OS privileges; it performs only the explicit
  commands above and returns status, never silent background actions.
- No vault secrets cross the bridge for VPN/call commands — only opaque config
  identifiers the native side already holds.
