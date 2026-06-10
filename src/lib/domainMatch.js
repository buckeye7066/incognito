/**
 * Login ↔ domain matching for autofill.
 *
 * A sandboxed web app cannot read the active browser tab's URL or inject
 * credentials into a foreign page — that requires the companion extension
 * (see lib/extensionBridge.js). But deciding *which saved logins match a given
 * domain* is pure logic, and it is the same decision the extension must make.
 * Centralizing it here means:
 *   - the web app can honestly PREVIEW matches ("3 logins would autofill on
 *     github.com") even with no extension installed, and
 *   - the extension has one source of truth for matching, so in-app preview
 *     and on-page autofill never disagree.
 *
 * This module is PURE (only imports the hostname normalizer) so it is unit-
 * testable in isolation and reusable by a future backend or the extension.
 */
import { hostnameOf } from './passwordImport';

/** Match quality tiers, strongest first. */
export const MATCH_EXACT = 'exact';   // identical hostname (mail.proton.me == mail.proton.me)
export const MATCH_DOMAIN = 'domain'; // same registrable domain (login.example.com ~ example.com)

const TIER_RANK = { [MATCH_EXACT]: 2, [MATCH_DOMAIN]: 1 };

/**
 * Curated multi-label public suffixes.
 *
 * We deliberately do NOT ship the full Public Suffix List (thousands of
 * entries, ~30 KB) — a family vault only realistically meets a handful of
 * multi-part TLDs. Anything not listed collapses to its last two labels.
 *
 * `github.io` / `githubusercontent.com` are listed on purpose: they are
 * effectively public suffixes, so `alice.github.io` and `bob.github.io` must
 * be treated as DIFFERENT sites — collapsing them to `github.io` would let one
 * user's saved login offer to autofill on another user's page. That is the
 * security half of the security-vs-convenience trade-off this file embodies.
 */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'gov.au', 'edu.au', 'id.au',
  'co.nz', 'org.nz', 'govt.nz',
  'co.jp', 'or.jp', 'ne.jp', 'co.kr', 'co.in', 'co.za',
  'com.br', 'com.mx', 'com.cn', 'com.tr', 'com.sg', 'com.hk', 'com.tw',
  'github.io', 'githubusercontent.com', 'pages.dev', 'web.app', 'firebaseapp.com',
]);

/**
 * Collapse a hostname (or full URL) to its registrable domain — the part a
 * single owner controls.
 *
 *   accounts.google.com   → google.com
 *   www.example.co.uk     → example.co.uk
 *   alice.github.io       → alice.github.io   (github.io is a public suffix)
 *   localhost             → localhost
 *
 * @param {string} hostnameOrUrl
 * @returns {string} lowercase registrable domain, or '' for empty input.
 */
export function registrableDomain(hostnameOrUrl) {
  const host = hostnameOf(hostnameOrUrl).toLowerCase();
  if (!host || !host.includes('.')) return host; // single-label hosts (localhost, intranet names)
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  // If the final two labels form a known multi-part suffix (co.uk, github.io…),
  // the registrable domain needs one more label to be meaningful.
  if (labels.length >= 3 && MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

/** Pull the best URL-ish field off a login entry, tolerating shape variance. */
function entryUrl(entry) {
  return entry?.service_url || entry?.url || entry?.domain || entry?.website || '';
}

/**
 * Classify how a single login entry matches a target URL/domain.
 * @returns {typeof MATCH_EXACT | typeof MATCH_DOMAIN | null}
 */
export function classifyMatch(entry, targetUrl) {
  const eHost = hostnameOf(entryUrl(entry)).toLowerCase();
  const tHost = hostnameOf(targetUrl).toLowerCase();
  if (!eHost || !tHost) return null;
  if (eHost === tHost) return MATCH_EXACT;
  const eReg = registrableDomain(eHost);
  const tReg = registrableDomain(tHost);
  if (eReg && eReg === tReg) return MATCH_DOMAIN;
  return null;
}

/**
 * Find the saved logins that would autofill on `targetUrl`, strongest first.
 *
 * @param {object[]} entries   PasswordEntry-shaped logins (service_url/url/domain)
 * @param {string}   targetUrl the domain or URL of the page being filled
 * @param {object}  [opts]
 * @param {('exact'|'domain')} [opts.minTier='domain'] minimum match strictness.
 *        'exact' = only identical hostnames; 'domain' = also same-site subdomains.
 * @returns {Array<{ entry: object, tier: string }>}
 */
export function matchLogins(entries, targetUrl, { minTier = MATCH_DOMAIN } = {}) {
  if (!Array.isArray(entries) || !hostnameOf(targetUrl)) return [];
  const minRank = TIER_RANK[minTier] ?? TIER_RANK[MATCH_DOMAIN];
  return entries
    .map((entry) => ({ entry, tier: classifyMatch(entry, targetUrl) }))
    .filter((m) => m.tier && TIER_RANK[m.tier] >= minRank)
    .sort((a, b) => {
      const byTier = TIER_RANK[b.tier] - TIER_RANK[a.tier];
      if (byTier) return byTier;
      const an = (a.entry.service_name || a.entry.site || entryUrl(a.entry)).toLowerCase();
      const bn = (b.entry.service_name || b.entry.site || entryUrl(b.entry)).toLowerCase();
      return an.localeCompare(bn);
    });
}

/** Convenience: just the count, for badges/summaries without building the list. */
export function countMatches(entries, targetUrl, opts) {
  return matchLogins(entries, targetUrl, opts).length;
}

export default { registrableDomain, classifyMatch, matchLogins, countMatches, MATCH_EXACT, MATCH_DOMAIN };
