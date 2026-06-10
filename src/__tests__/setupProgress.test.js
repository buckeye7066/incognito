import { describe, it, expect, beforeEach } from 'vitest';
import { getProgress, setStepDone, completedCount, percentComplete } from '@/lib/setupProgress';

describe('setupProgress: pure math', () => {
  it('counts completed steps', () => {
    expect(completedCount({})).toBe(0);
    expect(completedCount({ 0: true, 2: true })).toBe(2);
    expect(completedCount(null)).toBe(0);
  });

  it('computes percent against a total', () => {
    expect(percentComplete({}, 4)).toBe(0);
    expect(percentComplete({ 0: true, 1: true }, 4)).toBe(50);
    expect(percentComplete({ 0: true, 1: true, 2: true, 3: true }, 4)).toBe(100);
    expect(percentComplete({ 0: true }, 0)).toBe(0); // guard against /0
  });
});

describe('setupProgress: persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips step completion', () => {
    expect(getProgress('twilio')).toEqual({});
    setStepDone('twilio', 0, true);
    setStepDone('twilio', 1, true);
    expect(getProgress('twilio')).toEqual({ 0: true, 1: true });
    setStepDone('twilio', 0, false);
    expect(getProgress('twilio')).toEqual({ 1: true });
  });

  it('keeps separate guides independent', () => {
    setStepDone('twilio', 0, true);
    setStepDone('backup', 2, true);
    expect(getProgress('twilio')).toEqual({ 0: true });
    expect(getProgress('backup')).toEqual({ 2: true });
  });
});
