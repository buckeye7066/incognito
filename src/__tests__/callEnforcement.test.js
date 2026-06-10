import { describe, it, expect } from 'vitest';
import { planEnforcement, mergeCallEvents, summarizeEnforcement, ENFORCEMENT } from '@/lib/callEnforcement';
import { ACTION } from '@/lib/callScreening';

describe('callEnforcement: planEnforcement', () => {
  it('is advisory when no native bridge', () => {
    const p = planEnforcement(ACTION.BLOCK, { hasBridge: false });
    expect(p.mode).toBe(ENFORCEMENT.ADVISORY);
    expect(p.command).toBeNull();
    expect(p.note).toMatch(/companion app/i);
  });

  it('enforces block/allow when the bridge can screen', () => {
    expect(planEnforcement(ACTION.BLOCK, { hasBridge: true, canScreen: true }))
      .toMatchObject({ mode: ENFORCEMENT.ENFORCED, command: 'block' });
    expect(planEnforcement(ACTION.ALLOW, { hasBridge: true, canScreen: true }))
      .toMatchObject({ mode: ENFORCEMENT.ENFORCED, command: 'allow' });
  });

  it('never auto-drops a screened call, even with a bridge', () => {
    const p = planEnforcement(ACTION.SCREEN, { hasBridge: true, canScreen: true });
    expect(p.mode).toBe(ENFORCEMENT.ADVISORY);
    expect(p.command).toBeNull();
  });

  it('stays advisory if the bridge exists but cannot screen', () => {
    expect(planEnforcement(ACTION.BLOCK, { hasBridge: true, canScreen: false }).mode)
      .toBe(ENFORCEMENT.ADVISORY);
  });
});

describe('callEnforcement: mergeCallEvents', () => {
  const appLogs = [
    { caller_number: '6145551000', screened_at: '2026-06-10T10:00:00Z', action_taken: 'screen' },
    { caller_number: '6145552000', screened_at: '2026-06-09T10:00:00Z', action_taken: 'allow' },
  ];
  const nativeEvents = [
    { number: '6145551000', at: '2026-06-10T10:00:00Z', action: 'block' }, // same number+time → wins
    { number: '6145553000', at: '2026-06-11T10:00:00Z', action: 'block' },
  ];

  it('dedupes by number+time with the native record winning', () => {
    const merged = mergeCallEvents(appLogs, nativeEvents);
    const collided = merged.find((e) => e.number === '6145551000');
    expect(collided.source).toBe('native');
    expect(collided.action).toBe('block');
  });

  it('returns the union newest-first', () => {
    const merged = mergeCallEvents(appLogs, nativeEvents);
    expect(merged).toHaveLength(3);
    expect(merged[0].number).toBe('6145553000'); // 06-11 is newest
  });

  it('handles empty / missing inputs', () => {
    expect(mergeCallEvents()).toEqual([]);
    expect(mergeCallEvents(appLogs, [])).toHaveLength(2);
  });
});

describe('callEnforcement: summarizeEnforcement', () => {
  it('tallies actions and how many the OS enforced', () => {
    const merged = mergeCallEvents(
      [{ caller_number: '1', screened_at: 't1', action_taken: 'screen' }],
      [{ number: '2', at: 't2', action: 'block' }, { number: '3', at: 't3', action: 'allow' }],
    );
    const s = summarizeEnforcement(merged);
    expect(s).toMatchObject({ blocked: 1, allowed: 1, screened: 1, enforcedOnDevice: 2 });
  });
});
