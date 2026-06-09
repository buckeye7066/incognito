/**
 * Native/mobile bridge contract.
 *
 * Some capabilities (turning a system VPN on/off, OS-level call screening)
 * cannot be done from a web context. A companion native app (Capacitor/Tauri/
 * Electron) injects `window.__INCOGNITO_NATIVE__` implementing these commands.
 * Absent the bridge, calls reject with E_NO_NATIVE_BRIDGE and the UI shows the
 * honest "config/leak-checker only" state.
 *
 * See docs/NATIVE_BRIDGE.md and docs/NATIVE_VPN_BRIDGE.md.
 */

const GLOBAL = '__INCOGNITO_NATIVE__';

export function getNative() {
  if (typeof window === 'undefined') return null;
  return window[GLOBAL] || null;
}

export function isNativeBridgePresent() {
  const n = getNative();
  return Boolean(n && typeof n.platform === 'string');
}

function noBridge(command) {
  const err = new Error(
    `Native bridge not available — "${command}" requires the companion native app.`,
  );
  err.code = 'E_NO_NATIVE_BRIDGE';
  return err;
}

async function call(command, payload) {
  const n = getNative();
  if (!n || typeof n.invoke !== 'function') {
    throw noBridge(command);
  }
  return n.invoke(command, payload);
}

export const nativeBridge = {
  isPresent: isNativeBridgePresent,
  platform: () => getNative()?.platform || null,
  vpn: {
    status: () => call('vpn.status'),
    connect: (location) => call('vpn.connect', { location }),
    disconnect: () => call('vpn.disconnect'),
    listLocations: () => call('vpn.listLocations'),
  },
};

export default nativeBridge;
