import { describe, it, expect } from 'vitest';
import {
  isPlausibleNanp,
  isTollFree,
  isNeighborSpoof,
  assessCaller,
  decideAction,
  explainAssessment,
  RISK,
  ACTION,
} from '@/lib/callScreening';

describe('callScreening: number validity', () => {
  it('accepts well-formed NANP numbers', () => {
    expect(isPlausibleNanp('+1 (614) 555-0142')).toBe(true);
    expect(isPlausibleNanp('6145550142')).toBe(true);
  });

  it('rejects impossible numbers', () => {
    expect(isPlausibleNanp('0145550142')).toBe(false); // area code starts 0
    expect(isPlausibleNanp('6140550142')).toBe(false); // exchange starts 0
    expect(isPlausibleNanp('1111111111')).toBe(false); // all-identical
    expect(isPlausibleNanp('12345')).toBe(false);       // too short
  });

  it('detects toll-free area codes', () => {
    expect(isTollFree('8005551234')).toBe(true);
    expect(isTollFree('8335551234')).toBe(true);
    expect(isTollFree('6145550142')).toBe(false);
  });

  it('detects neighbor spoofing (shared area code + exchange)', () => {
    expect(isNeighborSpoof('6145559999', '6145550142')).toBe(true);  // same first 6
    expect(isNeighborSpoof('6145550142', '6145550142')).toBe(false); // your own line
    expect(isNeighborSpoof('6149990142', '6145550142')).toBe(false); // different exchange
  });
});

describe('callScreening: assessCaller', () => {
  const myNumber = '6145550142';

  it('treats contacts as low-risk legitimate', () => {
    const a = assessCaller({ number: '2025551000', myNumber, contacts: ['2025551000'] });
    expect(a.riskLevel).toBe(RISK.LOW);
    expect(a.likelyType).toBe('legitimate');
    expect(a.signals.some((s) => s.code === 'contact')).toBe(true);
  });

  it('flags neighbor-spoofed unknown callers as high-risk scam', () => {
    const a = assessCaller({ number: '6145559999', myNumber, contacts: [] });
    expect(a.riskLevel).toBe(RISK.HIGH);
    expect(a.likelyType).toBe('scam');
    expect(a.signals.some((s) => s.code === 'neighbor_spoof')).toBe(true);
  });

  it('flags invalid caller IDs as scam', () => {
    const a = assessCaller({ number: '1111111111', myNumber });
    expect(a.likelyType).toBe('scam');
    expect(a.signals.some((s) => s.code === 'invalid_format')).toBe(true);
  });

  it('labels toll-free as telemarketer at medium risk', () => {
    const a = assessCaller({ number: '8005559999', myNumber });
    expect(a.likelyType).toBe('telemarketer');
    expect(a.riskLevel).toBe(RISK.MEDIUM);
  });

  it('a contact on a spoofed-looking prefix is still trusted', () => {
    const a = assessCaller({ number: '6145559999', myNumber, contacts: ['6145559999'] });
    expect(a.riskLevel).toBe(RISK.LOW);
    expect(a.signals.some((s) => s.code === 'neighbor_spoof')).toBe(false);
  });

  it('flags repeat callers from recent history', () => {
    const history = ['2025551000', '2025551000', '2025551000'];
    const a = assessCaller({ number: '2025551000', myNumber, history });
    expect(a.signals.some((s) => s.code === 'repeat_caller')).toBe(true);
  });

  it('handles withheld caller ID honestly', () => {
    const a = assessCaller({ number: '', myNumber });
    expect(a.riskLevel).toBe(RISK.MEDIUM);
    expect(a.signals[0].code).toBe('no_caller_id');
  });
});

describe('callScreening: decideAction', () => {
  const myNumber = '6145550142';

  it('always allows trusted contacts', () => {
    const a = assessCaller({ number: '2025551000', myNumber, contacts: ['2025551000'] });
    expect(decideAction(a)).toBe(ACTION.ALLOW);
  });

  it('always blocks blocklisted numbers', () => {
    const a = assessCaller({ number: '2025551000', myNumber, blocked: ['2025551000'] });
    expect(decideAction(a)).toBe(ACTION.BLOCK);
  });

  it('screens high risk by default, blocks only when auto-block opted in', () => {
    const a = assessCaller({ number: '6145559999', myNumber }); // high-risk spoof
    expect(decideAction(a)).toBe(ACTION.SCREEN);
    expect(decideAction(a, { autoBlockHighRisk: true })).toBe(ACTION.BLOCK);
  });

  it('never silently drops a medium-risk call (screens it)', () => {
    const a = assessCaller({ number: '8005559999', myNumber }); // telemarketer / medium
    expect(decideAction(a, { autoBlockHighRisk: true })).toBe(ACTION.SCREEN);
  });

  it('explainAssessment lists the signals', () => {
    const a = assessCaller({ number: '6145559999', myNumber });
    expect(explainAssessment(a)).toMatch(/spoof/i);
  });
});
