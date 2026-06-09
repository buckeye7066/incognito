# Native VPN Bridge

A web app **cannot** turn a system-wide VPN on or off. Incognito therefore
splits VPN into two honest capabilities:

| Capability | Status without native app | What it does |
|---|---|---|
| `vpn_config` | `ready` (local) | Import, **encrypt at rest**, and export WireGuard/OpenVPN configs; run IP / WebRTC / DNS leak checks. |
| `vpn_connect` | `needs_native_bridge` | Actually connect / disconnect the system VPN. |

## Rules

- The "Connect" button only appears when the native bridge is present
  (`nativeBridge.isPresent()`), exposing `vpn.connect` / `vpn.disconnect` /
  `vpn.status` / `vpn.listLocations`.
- "Connected" is shown **only** when `vpn.status` confirms it — never inferred,
  never faked.
- VPN config files are sensitive and are stored encrypted in the vault; export
  requires an unlocked vault.

## Leak checks (work without the bridge)

- **Public IP** check (already implemented via a public IP endpoint).
- **WebRTC** leak detection (browser-local, where feasible).
- **DNS** leak guidance (instructional; true DNS-leak testing needs the native
  side or an external test).
