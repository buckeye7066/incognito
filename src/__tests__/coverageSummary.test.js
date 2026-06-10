import { describe, it, expect } from 'vitest';
import { summarizeCoverage, CAPABILITY_META } from '@/lib/coverageSummary';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';

const S = CAPABILITY_STATUS;

function caps(map) {
  const out = {};
  for (const [k, status] of Object.entries(map)) out[k] = { status };
  return out;
}

describe('coverageSummary', () => {
  it('returns zeroed coverage for an empty map', () => {
    const r = summarizeCoverage({});
    expect(r).toMatchObject({ total: 0, ready: 0, usable: 0, needsSetup: 0, coveragePct: 0 });
    expect(r.topActions).toEqual([]);
  });

  it('counts ready + manual as usable, others as needing setup', () => {
    const r = summarizeCoverage(caps({
      [CAPABILITY.EMAIL_ALIAS]: S.READY,
      [CAPABILITY.SEARCH_DISCOVERY]: S.MANUAL_ONLY,
      [CAPABILITY.VIRTUAL_CARD]: S.NEEDS_PROVIDER,
      [CAPABILITY.AUTOFILL]: S.NEEDS_BROWSER_EXTENSION,
    }));
    expect(r.total).toBe(4);
    expect(r.ready).toBe(1);
    expect(r.usable).toBe(2);          // READY + MANUAL_ONLY
    expect(r.needsSetup).toBe(2);
    expect(r.coveragePct).toBe(50);
  });

  it('tallies a byStatus breakdown', () => {
    const r = summarizeCoverage(caps({
      [CAPABILITY.EMAIL_ALIAS]: S.READY,
      [CAPABILITY.PHONE_ALIAS]: S.READY,
      [CAPABILITY.VIRTUAL_CARD]: S.NEEDS_PROVIDER,
    }));
    expect(r.byStatus[S.READY]).toBe(2);
    expect(r.byStatus[S.NEEDS_PROVIDER]).toBe(1);
  });

  it('orders next actions by how close they are to working, then label', () => {
    const r = summarizeCoverage(caps({
      [CAPABILITY.VPN_CONNECT]: S.NEEDS_NATIVE_BRIDGE,
      [CAPABILITY.VIRTUAL_CARD]: S.NEEDS_PROVIDER,
      [CAPABILITY.AUTOFILL]: S.NEEDS_BROWSER_EXTENSION,
    }));
    // needs_provider (0) < needs_browser_extension (1) < needs_native_bridge (2)
    expect(r.topActions.map((a) => a.capability)).toEqual([
      CAPABILITY.VIRTUAL_CARD,
      CAPABILITY.AUTOFILL,
      CAPABILITY.VPN_CONNECT,
    ]);
  });

  it('attaches a friendly label + setup page to each action', () => {
    const r = summarizeCoverage(caps({ [CAPABILITY.CALL_SCREEN]: S.NEEDS_PROVIDER }));
    expect(r.topActions[0]).toMatchObject({
      capability: CAPABILITY.CALL_SCREEN,
      label: CAPABILITY_META[CAPABILITY.CALL_SCREEN].label,
      page: 'CallGuard',
    });
    expect(r.topActions[0].statusLabel).toBeTruthy();
  });

  it('excludes disabled capabilities from setup actions', () => {
    const r = summarizeCoverage(caps({
      [CAPABILITY.EMAIL_ALIAS]: S.READY,
      [CAPABILITY.LLM_ASSIST]: S.DISABLED,
    }));
    expect(r.topActions).toEqual([]);
    expect(r.needsSetup).toBe(1); // still counted as not-usable in the tally
  });

  it('ignores malformed capability entries', () => {
    const r = summarizeCoverage({ a: null, b: {}, c: { status: S.READY } });
    expect(r.total).toBe(1);
    expect(r.ready).toBe(1);
  });
});
