import { describe, it, expect } from 'vitest';
import {
  cardKind, validateCardForm, summarizeSpend, evaluateSelfDestruct,
  detectSubscriptions, normalizeTransaction, formatCents,
  CARD_STATUS, SPEND_DURATION,
} from '@/lib/cardPolicy';
import { CAPABILITY_STATUS } from '@/providers/capabilities';

describe('cardKind — honesty about real vs placeholder cards', () => {
  it('is "real" only with a provider token AND a usable capability', () => {
    const card = { card_token: 'tok_123', source: 'privacy.com' };
    expect(cardKind(card, CAPABILITY_STATUS.READY)).toBe('real');
  });

  it('is a placeholder when the provider is not ready, even with a token', () => {
    const card = { card_token: 'tok_123', source: 'privacy.com' };
    expect(cardKind(card, CAPABILITY_STATUS.NEEDS_PROVIDER)).toBe('placeholder');
  });

  it('is a placeholder for locally-created cards (no real number)', () => {
    expect(cardKind({ id: 'local1', source: 'incognito' }, CAPABILITY_STATUS.READY)).toBe('placeholder');
  });
});

describe('validateCardForm', () => {
  it('requires a name and a sane cents limit', () => {
    expect(validateCardForm({ merchant_name: '', spend_limit: 0, spend_limit_duration: 'MONTHLY' }).ok).toBe(false);
    const r = validateCardForm({ merchant_name: 'Netflix', spend_limit: 1599, spend_limit_duration: 'MONTHLY', card_type: 'MERCHANT_LOCKED' });
    expect(r.ok).toBe(true);
  });

  it('flags a suspiciously low limit (dollars entered as cents)', () => {
    const r = validateCardForm({ merchant_name: 'X', spend_limit: 15, spend_limit_duration: 'MONTHLY' });
    expect(r.ok).toBe(false);
    expect(r.errors.spend_limit).toMatch(/cents/i);
  });

  it('rejects an unknown duration window', () => {
    const r = validateCardForm({ merchant_name: 'X', spend_limit: 500, spend_limit_duration: 'WEEKLY' });
    expect(r.errors.spend_limit_duration).toBeTruthy();
  });
});

describe('summarizeSpend — period-aware', () => {
  const now = new Date('2026-06-15T00:00:00Z');

  it('only counts this calendar month for a MONTHLY card', () => {
    const card = { spend_limit: 10000, spend_limit_duration: SPEND_DURATION.MONTHLY };
    const txns = [
      { amount: 3000, created: '2026-06-02T00:00:00Z' },
      { amount: 2000, created: '2026-06-10T00:00:00Z' },
      { amount: 9999, created: '2026-05-30T00:00:00Z' }, // previous month — excluded
    ];
    const s = summarizeSpend(card, txns, now);
    expect(s.spent).toBe(5000);
    expect(s.remaining).toBe(5000);
    expect(s.pct).toBe(50);
    expect(s.overLimit).toBe(false);
  });

  it('FOREVER counts everything and flags over-limit', () => {
    const card = { spend_limit: 4000, spend_limit_duration: SPEND_DURATION.FOREVER };
    const txns = [{ amount: 3000, created: '2025-01-01' }, { amount: 2000, created: '2026-06-01' }];
    const s = summarizeSpend(card, txns, now);
    expect(s.spent).toBe(5000);
    expect(s.overLimit).toBe(true);
    expect(s.pct).toBe(100); // clamped
  });

  it('ignores declined/voided transactions', () => {
    const card = { spend_limit: 10000, spend_limit_duration: SPEND_DURATION.FOREVER };
    const txns = [{ amount: 5000, created: '2026-06-01', status: 'DECLINED' }];
    expect(summarizeSpend(card, txns, now).spent).toBe(0);
  });
});

describe('evaluateSelfDestruct — any condition trips it', () => {
  it('fires on transaction count', () => {
    const card = { self_destruct: { after_transactions: 1 } };
    expect(evaluateSelfDestruct(card, { txnCount: 1 }).shouldClose).toBe(true);
    expect(evaluateSelfDestruct(card, { txnCount: 0 }).shouldClose).toBe(false);
  });

  it('keeps the card alive through the cutoff day, closes after', () => {
    const card = { self_destruct: { after_date: '2026-06-05' } };
    expect(evaluateSelfDestruct(card, { now: new Date('2026-06-05T18:00:00Z') }).shouldClose).toBe(false);
    expect(evaluateSelfDestruct(card, { now: new Date('2026-06-06T00:01:00Z') }).shouldClose).toBe(true);
  });

  it('never re-closes an already CLOSED card', () => {
    const card = { status: CARD_STATUS.CLOSED, self_destruct: { after_transactions: 1 } };
    expect(evaluateSelfDestruct(card, { txnCount: 99 }).shouldClose).toBe(false);
  });
});

describe('detectSubscriptions — balanced heuristic', () => {
  // A clean monthly subscription: same amount, ~30-day cadence.
  const netflix = [
    { merchant: { descriptor: 'NETFLIX' }, amount: 1599, created: '2026-03-01' },
    { merchant: { descriptor: 'NETFLIX' }, amount: 1599, created: '2026-04-01' },
    { merchant: { descriptor: 'NETFLIX' }, amount: 1599, created: '2026-05-01' },
  ];

  it('flags a steady monthly charge and labels its cadence', () => {
    const [sub] = detectSubscriptions(netflix);
    expect(sub.merchant).toBe('NETFLIX');
    expect(sub.cadence).toBe('monthly');
    expect(sub.count).toBe(3);
    expect(sub.confidence).toBeGreaterThan(0.7);
  });

  it('does NOT flag two unrelated purchases at the same retailer (the old false positive)', () => {
    const amazon = [
      { merchant: { descriptor: 'AMAZON' }, amount: 4200, created: '2026-03-04' },
      { merchant: { descriptor: 'AMAZON' }, amount: 980, created: '2026-03-19' }, // wildly different amount
    ];
    expect(detectSubscriptions(amazon)).toHaveLength(0);
  });

  it('rejects irregular cadence even when amounts match', () => {
    const coffee = [
      { merchant: { descriptor: 'CAFE' }, amount: 500, created: '2026-01-01' },
      { merchant: { descriptor: 'CAFE' }, amount: 500, created: '2026-01-02' },
      { merchant: { descriptor: 'CAFE' }, amount: 500, created: '2026-05-30' }, // huge gap → irregular
    ];
    expect(detectSubscriptions(coffee)).toHaveLength(0);
  });

  it('ranks higher-confidence subscriptions first', () => {
    const mixed = [
      ...netflix,
      { merchant: { descriptor: 'SPOTIFY' }, amount: 1099, created: '2026-04-10' },
      { merchant: { descriptor: 'SPOTIFY' }, amount: 1099, created: '2026-05-10' },
    ];
    const subs = detectSubscriptions(mixed);
    expect(subs.map((s) => s.merchant)).toEqual(['NETFLIX', 'SPOTIFY']); // 3 charges outranks 2
  });
});

describe('helpers', () => {
  it('normalizeTransaction pulls a stable merchant + cents amount', () => {
    const t = normalizeTransaction({ merchant: { descriptor: 'HULU' }, amount: 1299, created: '2026-06-01' });
    expect(t).toMatchObject({ merchant: 'HULU', amount: 1299 });
  });

  it('formatCents renders dollars', () => {
    expect(formatCents(1599)).toBe('$15.99');
    expect(formatCents(0)).toBe('$0.00');
  });
});
