import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * VPN provider.
 *
 * A browser app CANNOT toggle a system-wide VPN. So this splits honestly:
 *   - VPN_CONFIG  : manage/encrypt/export WireGuard/OpenVPN configs  → local, ready
 *   - VPN_CONNECT : actually connect/disconnect                      → needs native bridge
 *
 * The app never claims the VPN is "connected" unless a native bridge confirms
 * it. See docs/NATIVE_VPN_BRIDGE.md.
 */
export const vpnConfigProvider = defineProvider({
  id: 'vpn_config',
  displayName: 'VPN config manager',
  description: 'Import, encrypt-at-rest, and export WireGuard/OpenVPN configs; run leak checks.',
  capabilities: [CAPABILITY.VPN_CONFIG],
  limitations: 'Config manager + IP/DNS leak checker only. It does not and cannot turn a VPN on by itself.',
  docsAnchor: 'vpn',
});

export const nativeVpnBridgeProvider = defineProvider({
  id: 'native_vpn_bridge',
  displayName: 'Native VPN bridge',
  description: 'Connect/disconnect the system VPN via a companion native app.',
  capabilities: [CAPABILITY.VPN_CONNECT],
  requiresNativeBridge: true,
  limitations: 'Requires a companion native/mobile app exposing the vpn.* bridge commands.',
  docsAnchor: 'vpn',
});

export default nativeVpnBridgeProvider;
