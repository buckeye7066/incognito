import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ALIAS_RULES, normalizeRules, isSenderBlocked, shouldForward,
  applyRuleChange, summarizeRules,
} from '@/lib/aliasRules';

describe('aliasRules', () => {
  it('normalizes partial/legacy rules', () => {
    expect(normalizeRules(undefined)).toEqual(DEFAULT_ALIAS_RULES);
    expect(normalizeRules({ forward: false, blocked_senders: ['A@B.com'] }))
      .toMatchObject({ forward: false, muted: false, blocked_senders: ['a@b.com'], allowed_senders: [] });
  });

  it('allowlist overrides blocklist', () => {
    const r = { blocked_senders: ['x@y.com'], allowed_senders: ['x@y.com'] };
    expect(isSenderBlocked(r, 'X@Y.com')).toBe(false);
    expect(isSenderBlocked({ blocked_senders: ['x@y.com'] }, 'x@y.com')).toBe(true);
  });

  it('shouldForward respects forward/mute/block', () => {
    expect(shouldForward({}, 'a@b.com')).toBe(true);
    expect(shouldForward({ forward: false }, 'a@b.com')).toBe(false);
    expect(shouldForward({ muted: true }, 'a@b.com')).toBe(false);
    expect(shouldForward({ blocked_senders: ['a@b.com'] }, 'a@b.com')).toBe(false);
  });

  it('applyRuleChange handles every change type', () => {
    let r = applyRuleChange(undefined, { type: 'forward_off' });
    expect(r.forward).toBe(false);
    r = applyRuleChange(r, { type: 'block', sender: 'Spam@x.com' });
    expect(r.blocked_senders).toEqual(['spam@x.com']);
    r = applyRuleChange(r, { type: 'allow', sender: 'spam@x.com' });
    expect(r.allowed_senders).toEqual(['spam@x.com']);
    expect(r.blocked_senders).toEqual([]); // allow removes from block
    r = applyRuleChange(r, { type: 'unallow', sender: 'spam@x.com' });
    expect(r.allowed_senders).toEqual([]);
    expect(() => applyRuleChange(r, { type: 'nope' })).toThrow(/Unknown/);
  });

  it('summarizeRules gives a readable summary', () => {
    expect(summarizeRules({ muted: true })).toBe('Muted');
    expect(summarizeRules({ forward: false })).toBe('Forwarding off');
    expect(summarizeRules({ blocked_senders: ['a@b.com'] })).toContain('1 blocked');
  });
});
