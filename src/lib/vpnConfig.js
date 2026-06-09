/**
 * VPN config parsing + leak analysis (Pass 13).
 *
 * Pure helpers. The config manager + leak checker are local/ready; actually
 * connecting requires the native bridge. The honesty rule lives in
 * `vpnConnectionState`: we NEVER report "connected" unless the bridge confirms.
 */

/** Parse a WireGuard .conf into structured metadata (no secrets returned raw). */
export function parseWireguardConfig(text) {
  const out = { valid: false, interface: {}, peer: {}, hasPrivateKey: false };
  if (typeof text !== 'string') return out;
  let section = '';
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sec = line.match(/^\[(\w+)\]$/);
    if (sec) { section = sec[1].toLowerCase(); continue; }
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim();
    if (section === 'interface') {
      if (key === 'address') out.interface.address = val;
      if (key === 'dns') out.interface.dns = val;
      if (key === 'privatekey') out.hasPrivateKey = true; // presence only — never echo it
    } else if (section === 'peer') {
      if (key === 'endpoint') out.peer.endpoint = val;
      if (key === 'allowedips') out.peer.allowedIps = val;
      if (key === 'publickey') out.peer.publicKey = val;
    }
  }
  out.valid = Boolean(out.peer.endpoint && (out.interface.address || out.hasPrivateKey));
  return out;
}

/**
 * Truthful connection state. The native bridge is the ONLY source of truth for
 * "connected". Absent it, the most we can say is "config manager only".
 */
export function vpnConnectionState({ bridgePresent, bridgeStatus }) {
  if (!bridgePresent) return { connected: false, label: 'Config manager only (no native app)' };
  const connected = bridgeStatus?.connected === true;
  return {
    connected,
    label: connected ? `Connected${bridgeStatus.location ? ` — ${bridgeStatus.location}` : ''}` : 'Disconnected',
  };
}

/**
 * IP-leak analysis. If the public IP equals the known real IP, traffic is
 * leaking (or the VPN is off). We never infer "protected" — only "no leak
 * detected", and only when the bridge says it's connected.
 */
export function detectIpLeak({ publicIp, knownRealIp, bridgeConnected }) {
  if (!publicIp) return { status: 'unknown', reason: 'could not determine public IP' };
  if (!bridgeConnected) {
    return { status: 'not_protected', reason: 'VPN not confirmed connected by the native bridge' };
  }
  if (knownRealIp && publicIp === knownRealIp) {
    return { status: 'leaking', reason: 'public IP matches your real IP while VPN claims connected' };
  }
  return { status: 'no_leak_detected', reason: 'public IP differs from your known real IP' };
}
