import { describe, it, expect } from 'vitest';
import {
  normalizeCoverage,
  findCoverage,
  routeIncomingCall,
  buildVoiceTwiml,
  routeToEvent,
  ROUTE,
} from '@/lib/callRouting';

// Mom's screening number publishes 614-555-0100, rings her real line 614-555-0199.
const COVERAGE = [
  { twilioNumber: '+16145550100', label: 'Mom', forwardTo: '+16145550199', policy: { autoBlockHighRisk: true } },
  { twilioNumber: '+16145550200', label: 'Me', forwardTo: '+16145550299', policy: { voicemailOnScreen: true, record: true } },
];

describe('callRouting: coverage model', () => {
  it('normalizes and filters coverage entries', () => {
    const norm = normalizeCoverage([{ number: '+1 (614) 555-0100', label: 'Mom', forwardTo: '614-555-0199' }, { label: 'junk' }]);
    expect(norm).toHaveLength(1);
    expect(norm[0]).toMatchObject({ twilioNumber: '6145550100', forwardTo: '6145550199', label: 'Mom' });
  });

  it('finds coverage by the called (Twilio) number regardless of formatting', () => {
    expect(findCoverage(COVERAGE, '(614) 555-0100')?.label).toBe('Mom');
    expect(findCoverage(COVERAGE, '+19999999999')).toBeNull();
  });
});

describe('callRouting: routeIncomingCall', () => {
  it('rejects calls to a number we do not manage', () => {
    expect(routeIncomingCall({ from: '+12025550000', to: '+19999999999', coverage: COVERAGE }))
      .toEqual({ action: ROUTE.REJECT, reason: 'number_not_covered' });
  });

  it('forwards an allowed (trusted contact) caller to the real phone', () => {
    const d = routeIncomingCall({ from: '+12025551111', to: '+16145550100', coverage: COVERAGE, contacts: ['+12025551111'] });
    expect(d.action).toBe(ROUTE.FORWARD);
    expect(d.dialTo).toBe('+16145550199');
    expect(d.label).toBe('Mom');
  });

  it('rejects a high-risk caller when the number auto-blocks', () => {
    // Neighbor-spoof of Mom's real line, unknown → high risk; Mom auto-blocks.
    const d = routeIncomingCall({ from: '+16145550123', to: '+16145550100', coverage: COVERAGE });
    expect(d.action).toBe(ROUTE.REJECT);
    expect(d.assessment.riskLevel).toBe('high');
  });

  it('sends a screened caller to voicemail when the number prefers it, records when allowed', () => {
    // "Me" → voicemailOnScreen; a medium-risk toll-free caller is screened → voicemail.
    const screened = routeIncomingCall({ from: '+18005559999', to: '+16145550200', coverage: COVERAGE });
    expect(screened.action).toBe(ROUTE.VOICEMAIL);
    // A trusted caller to "Me" is allowed AND recorded.
    const allowed = routeIncomingCall({ from: '+12025552222', to: '+16145550200', coverage: COVERAGE, contacts: ['+12025552222'] });
    expect(allowed.action).toBe(ROUTE.RECORD_FORWARD);
    expect(allowed.dialTo).toBe('+16145550299');
  });

  it("honors a covered number's own allow/block lists", () => {
    const cov = [{
      twilioNumber: '+16145550100', label: 'Mom', forwardTo: '+16145550199',
      contacts: ['+12025557777'], blocked: ['+13035558888'], policy: {},
    }];
    expect(routeIncomingCall({ from: '+12025557777', to: '+16145550100', coverage: cov }).action).toBe(ROUTE.FORWARD);
    expect(routeIncomingCall({ from: '+13035558888', to: '+16145550100', coverage: cov }).action).toBe(ROUTE.REJECT);
  });

  it('falls back to voicemail (never drops) if allowed but no forward number', () => {
    const cov = [{ twilioNumber: '+16145550100', label: 'X', forwardTo: '' }];
    const d = routeIncomingCall({ from: '+12025553333', to: '+16145550100', coverage: cov, contacts: ['+12025553333'] });
    expect(d.action).toBe(ROUTE.VOICEMAIL);
    expect(d.reason).toBe('allow_no_forward');
  });
});

describe('callRouting: buildVoiceTwiml', () => {
  it('renders forward / record / screen / voicemail / reject', () => {
    expect(buildVoiceTwiml({ action: ROUTE.FORWARD, dialTo: '+16145550199' })).toContain('<Dial>+16145550199</Dial>');
    expect(buildVoiceTwiml({ action: ROUTE.RECORD_FORWARD, dialTo: '+1614' })).toContain('record="record-from-answer-dual"');
    expect(buildVoiceTwiml({ action: ROUTE.SCREEN })).toMatch(/<Record maxLength="30"/);
    expect(buildVoiceTwiml({ action: ROUTE.VOICEMAIL })).toMatch(/<Record maxLength="120"/);
    expect(buildVoiceTwiml({ action: ROUTE.REJECT })).toContain('<Reject reason="rejected"/>');
  });

  it('produces valid XML envelopes and escapes prompts', () => {
    const twiml = buildVoiceTwiml({ action: ROUTE.SCREEN }, { screenPrompt: 'Hi <there> & "you"' });
    expect(twiml.startsWith('<?xml version="1.0" encoding="UTF-8"?><Response>')).toBe(true);
    expect(twiml).toContain('&lt;there&gt;');
    expect(twiml).not.toContain('<there>');
  });
});

describe('callRouting: routeToEvent', () => {
  it('produces a metadata-only log event (no recording/body)', () => {
    const d = routeIncomingCall({ from: '+12025551111', to: '+16145550100', coverage: COVERAGE, contacts: ['+12025551111'] });
    const evt = routeToEvent(d, { from: '+12025551111', to: '+16145550100' });
    expect(evt).toMatchObject({ type: 'call_routed', action: ROUTE.FORWARD, label: 'Mom', from: '+12025551111' });
    expect(evt).not.toHaveProperty('body');
    expect(evt.received_at).toBeTruthy();
  });
});
