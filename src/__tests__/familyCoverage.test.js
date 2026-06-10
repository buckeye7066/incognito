import { describe, it, expect } from 'vitest';
import { coverageEntryValid, splitNumbers, maskPhone, entityToBackend, toBackendCoverage } from '@/lib/familyCoverage';

describe('familyCoverage', () => {
  it('validates entries needing both a published and a real number', () => {
    expect(coverageEntryValid({ twilio_number: '+16145550100', forward_to: '+16145550199' })).toBe(true);
    expect(coverageEntryValid({ twilio_number: '+16145550100' })).toBe(false);
    expect(coverageEntryValid({})).toBe(false);
  });

  it('splits numbers from arrays or delimited strings', () => {
    expect(splitNumbers(['+1614', '+1202'])).toEqual(['+1614', '+1202']);
    expect(splitNumbers('+1614, +1202\n+1303; +1404')).toEqual(['+1614', '+1202', '+1303', '+1404']);
    expect(splitNumbers('')).toEqual([]);
  });

  it('masks numbers to the last four digits', () => {
    expect(maskPhone('+16145550199')).toBe('•••‑0199');
    expect(maskPhone('12')).toBe('12');
  });

  it('maps an entity to the backend shape with policy flags', () => {
    const e = {
      label: 'Mom', twilio_number: '+16145550100', forward_to: '+16145550199',
      contacts: '+12025551111, +12025552222', blocked: ['+13035558888'],
      auto_block_high_risk: true, voicemail_on_screen: false, record: true,
    };
    expect(entityToBackend(e)).toEqual({
      twilioNumber: '+16145550100',
      label: 'Mom',
      forwardTo: '+16145550199',
      contacts: ['+12025551111', '+12025552222'],
      blocked: ['+13035558888'],
      policy: { autoBlockHighRisk: true, voicemailOnScreen: false, record: true },
    });
  });

  it('filters invalid entries out of the backend payload', () => {
    const list = [
      { label: 'ok', twilio_number: '+16145550100', forward_to: '+16145550199' },
      { label: 'missing forward', twilio_number: '+16145550200' },
    ];
    const out = toBackendCoverage(list);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('ok');
  });
});
