import { defineProvider } from '../baseProvider.js';
import { CAPABILITY } from '../capabilities.js';

/**
 * Native call-screening provider.
 *
 * Mirrors the VPN split: the web app screens a caller from on-device signals
 * (CALL_SCREEN, always available — lib/callScreening.js), but actually BLOCKING
 * or ALLOWING a live call (CALL_BLOCK) needs OS dialer access only the companion
 * native shell has. When the native bridge is absent the registry reports
 * NEEDS_NATIVE_BRIDGE, so the UI is honest that screening is advisory-only.
 *
 * See docs/NATIVE_BRIDGE.md (call.* commands).
 */
export const nativeCallProvider = defineProvider({
  id: 'native_call_bridge',
  displayName: 'Native call screening',
  description: 'Block/allow callers and screen live calls via the companion native app.',
  capabilities: [CAPABILITY.CALL_BLOCK],
  requiresNativeBridge: true,
  limitations: 'Requires a companion native/mobile app exposing the call.* bridge commands.',
  docsAnchor: 'native_bridge',
});

export default nativeCallProvider;
