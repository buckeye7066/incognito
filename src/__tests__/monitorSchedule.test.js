import { describe, it, expect } from 'vitest';
import {
  severityRank, sortBySeverity, intervalHours, nextCheckAt, isDue, dueItems,
  summarizeMonitoring, ssnLast4, maskSSN, lastCheckedAt,
} from '@/lib/monitorSchedule';

const HOUR = 3_600_000;

describe('severity ordering', () => {
  it('ranks critical > high > medium > low > info', () => {
    expect(severityRank('critical')).toBeGreaterThan(severityRank('high'));
    expect(severityRank('low')).toBeGreaterThan(severityRank('info'));
    expect(severityRank('nonsense')).toBe(0);
  });

  it('sortBySeverity puts worst first, then newest, without mutating input', () => {
    const input = [
      { risk_level: 'low', checked_at: '2026-06-01' },
      { risk_level: 'critical', checked_at: '2026-05-01' },
      { risk_level: 'critical', checked_at: '2026-06-08' },
    ];
    const out = sortBySeverity(input);
    expect(out.map((a) => a.risk_level)).toEqual(['critical', 'critical', 'low']);
    expect(out[0].checked_at).toBe('2026-06-08'); // newer critical first
    expect(input[0].risk_level).toBe('low'); // original untouched
  });
});

describe('intervalHours — severity-adaptive cadence', () => {
  it('uses the item baseline for low risk', () => {
    expect(intervalHours({ check_frequency_hours: 24 }, 'low')).toBe(24);
  });

  it('re-checks critical findings ~4x sooner', () => {
    expect(intervalHours({ check_frequency_hours: 24 }, 'critical')).toBe(6);
    expect(intervalHours({ check_frequency_hours: 24 }, 'high')).toBe(12);
  });

  it('honors a fixed-interval override', () => {
    expect(intervalHours({ check_frequency_hours: 24 }, 'critical', { adaptive: false })).toBe(24);
  });

  it('defaults to 24h when no frequency set', () => {
    expect(intervalHours({}, 'low')).toBe(24);
  });
});

describe('isDue / nextCheckAt', () => {
  const now = new Date('2026-06-09T12:00:00Z');

  it('an enabled, never-checked item is due now', () => {
    expect(isDue({ monitoring_enabled: true }, now)).toBe(true);
    expect(nextCheckAt({}, 'low')).toBeNull();
  });

  it('respects the interval window for low-risk items', () => {
    const justChecked = { check_frequency_hours: 24, checked_at: new Date(now.getTime() - 1 * HOUR).toISOString() };
    expect(isDue(justChecked, now)).toBe(false);
    const stale = { check_frequency_hours: 24, checked_at: new Date(now.getTime() - 25 * HOUR).toISOString() };
    expect(isDue(stale, now)).toBe(true);
  });

  it('a critical item becomes due sooner than its baseline', () => {
    // checked 7h ago, 24h baseline → low not due, but critical (6h) is due
    const item = { check_frequency_hours: 24, checked_at: new Date(now.getTime() - 7 * HOUR).toISOString() };
    expect(isDue({ ...item, risk_level: 'low' }, now)).toBe(false);
    expect(isDue({ ...item, risk_level: 'critical' }, now)).toBe(true);
  });

  it('disabled items are never due', () => {
    expect(isDue({ monitoring_enabled: false }, now)).toBe(false);
  });

  it('dueItems filters the collection', () => {
    const items = [
      { id: 'a', monitoring_enabled: true }, // never checked → due
      { id: 'b', monitoring_enabled: false }, // disabled
      { id: 'c', check_frequency_hours: 24, checked_at: new Date(now.getTime() - 2 * HOUR).toISOString() }, // fresh
    ];
    expect(dueItems(items, now).map((i) => i.id)).toEqual(['a']);
  });
});

describe('summarizeMonitoring — honest coverage', () => {
  const now = new Date('2026-06-09T12:00:00Z');
  const items = [
    { monitoring_enabled: true, checked_at: '2026-06-09T11:00:00Z', check_frequency_hours: 24 },
    { monitoring_enabled: true }, // never checked → due
    { monitoring_enabled: false },
  ];

  it('reports scheduled re-checks only when dark-web monitoring is READY', () => {
    const s = summarizeMonitoring(items, { darkwebReady: true, now });
    expect(s.monitoringReal).toBe(true);
    expect(s.coverageLabel).toMatch(/scheduled re-checks/i);
    expect(s.enabled).toBe(2);
    expect(s.dueCount).toBe(1);
  });

  it('falls back to "manual / on-demand" when only breach_check is available', () => {
    const s = summarizeMonitoring(items, { breachReady: true, now });
    expect(s.monitoringReal).toBe(false);
    expect(s.canCheck).toBe(true);
    expect(s.coverageLabel).toMatch(/manual|on-demand/i);
  });

  it('says no provider connected when nothing is usable', () => {
    const s = summarizeMonitoring(items, { now });
    expect(s.canCheck).toBe(false);
    expect(s.coverageLabel).toMatch(/no breach provider/i);
  });
});

describe('SSN display helpers', () => {
  it('extracts last 4 from a full or formatted SSN', () => {
    expect(ssnLast4('123-45-6789')).toBe('6789');
    expect(ssnLast4('6789')).toBe('6789');
  });

  it('masks to XXX-XX-#### and never reveals the first five', () => {
    expect(maskSSN('123-45-6789')).toBe('XXX-XX-6789');
    expect(maskSSN('6789')).toBe('XXX-XX-6789');
    expect(maskSSN('')).toBe('');
  });

  it('lastCheckedAt tolerates differing entity field names', () => {
    expect(lastCheckedAt({ checked_at: 'x' })).toBe('x');
    expect(lastCheckedAt({ last_scan: 'y' })).toBe('y');
    expect(lastCheckedAt({})).toBeNull();
  });
});
