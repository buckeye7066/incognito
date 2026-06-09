import { describe, it, expect } from 'vitest';
import {
  BROKER_TASK_STATUS as B, nextBrokerTaskState, canConfirmRemoved, campaignProgress, isTerminal,
} from '@/lib/brokerRemoval';
import { parseWireguardConfig, vpnConnectionState, detectIpLeak } from '@/lib/vpnConfig';
import { redactText, containsRestricted, assertSafeForLLM, buildSafeProfileSummary } from '@/lib/aiRedaction';

describe('brokerRemoval state machine', () => {
  it('allows legal transitions', () => {
    expect(nextBrokerTaskState(B.READY, B.SUBMITTED)).toBe(B.SUBMITTED);
    expect(nextBrokerTaskState(B.SUBMITTED, B.WAITING_VERIFICATION)).toBe(B.WAITING_VERIFICATION);
  });
  it('rejects illegal transitions', () => {
    expect(() => nextBrokerTaskState(B.READY, B.REMOVED)).toThrow(/Illegal/);
    expect(() => nextBrokerTaskState(B.SUBMITTED, B.REMOVED)).toThrow(/Illegal/);
  });
  it('only confirms removed from verifiable states', () => {
    expect(canConfirmRemoved(B.WAITING_VERIFICATION)).toBe(true);
    expect(canConfirmRemoved(B.IN_PROGRESS)).toBe(true);
    expect(canConfirmRemoved(B.READY)).toBe(false);
    expect(nextBrokerTaskState(B.WAITING_VERIFICATION, B.REMOVED)).toBe(B.REMOVED);
  });
  it('removed can only reopen via reappeared', () => {
    expect(nextBrokerTaskState(B.REMOVED, B.REAPPEARED)).toBe(B.REAPPEARED);
    expect(() => nextBrokerTaskState(B.REMOVED, B.READY)).toThrow(/Illegal/);
    expect(isTerminal(B.REMOVED)).toBe(true);
  });
  it('campaignProgress rolls up counts + percent', () => {
    const p = campaignProgress([
      { status: B.REMOVED }, { status: B.REMOVED },
      { status: B.NEEDS_USER_ACTION }, { status: B.SUBMITTED },
    ]);
    expect(p).toMatchObject({ total: 4, removed: 2, needsAction: 1, inProgress: 1, percent: 50 });
  });
});

describe('vpnConfig + leak analysis', () => {
  const WG = `[Interface]
PrivateKey = abc123=
Address = 10.0.0.2/32
DNS = 1.1.1.1
[Peer]
PublicKey = peerkey=
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0`;

  it('parses a WireGuard config without echoing the private key', () => {
    const c = parseWireguardConfig(WG);
    expect(c.valid).toBe(true);
    expect(c.interface.address).toBe('10.0.0.2/32');
    expect(c.peer.endpoint).toBe('vpn.example.com:51820');
    expect(c.hasPrivateKey).toBe(true);
    expect(JSON.stringify(c)).not.toContain('abc123');
  });
  it('never reports connected without the native bridge', () => {
    expect(vpnConnectionState({ bridgePresent: false }).connected).toBe(false);
    expect(vpnConnectionState({ bridgePresent: true, bridgeStatus: { connected: true, location: 'NL' } }))
      .toMatchObject({ connected: true });
  });
  it('detects leaks honestly', () => {
    expect(detectIpLeak({ publicIp: '', bridgeConnected: true }).status).toBe('unknown');
    expect(detectIpLeak({ publicIp: '1.2.3.4', bridgeConnected: false }).status).toBe('not_protected');
    expect(detectIpLeak({ publicIp: '1.2.3.4', knownRealIp: '1.2.3.4', bridgeConnected: true }).status).toBe('leaking');
    expect(detectIpLeak({ publicIp: '9.9.9.9', knownRealIp: '1.2.3.4', bridgeConnected: true }).status).toBe('no_leak_detected');
  });
});

describe('aiRedaction guard', () => {
  it('redacts SSN/card/email/phone/DOB', () => {
    const { redacted, found } = redactText('SSN 123-45-6789, card 4111 1111 1111 1111, a@b.com, 555-123-4567, 01/02/1990');
    expect(redacted).toContain('[SSN]');
    expect(redacted).toContain('[CARD]');
    expect(redacted).toContain('[EMAIL]');
    expect(redacted).toContain('[PHONE]');
    expect(redacted).toContain('[DOB]');
    expect(redacted).not.toContain('123-45-6789');
    expect(found).toEqual(expect.arrayContaining(['ssn', 'card', 'email', 'phone', 'dob']));
  });
  it('containsRestricted + assertSafeForLLM gate', () => {
    expect(containsRestricted('my ssn is 123-45-6789')).toBe(true);
    expect(containsRestricted('just a harmless note')).toBe(false);
    expect(() => assertSafeForLLM({ note: 'ssn 123-45-6789' })).toThrow(/restricted/i);
    try { assertSafeForLLM('ssn 123-45-6789'); } catch (e) {
      expect(e.code).toBe('E_RESTRICTED_DATA');
      expect(e.found).toContain('ssn');
    }
    expect(assertSafeForLLM({ topic: 'general privacy posture' })).toBe(true);
  });
  it('buildSafeProfileSummary drops children + secret-ish keys and redacts strings', () => {
    const { summary, redactedFields } = buildSafeProfileSummary({
      name: 'Family', ssn: '123-45-6789', password: 'x',
      bio: 'reach me at a@b.com', children: [{ name: 'kid' }],
    });
    expect(summary.ssn).toBeUndefined();
    expect(summary.password).toBeUndefined();
    expect(summary.children).toBeUndefined();
    expect(summary.bio).toContain('[EMAIL]');
    expect(redactedFields).toEqual(expect.arrayContaining(['ssn', 'password', 'children', 'bio']));
  });
});
