import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * CI guard for the companion extension manifest. Pins the security properties
 * from the hardening review so they can't silently regress — most importantly
 * the CRITICAL origin-spoofing fix (no wildcard-subdomain app origin).
 */
const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, '../../extension/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

/** App-origin allow-lists that act as a trust boundary (NOT the all-urls site script). */
function appOriginLists() {
  const lists = [];
  const appContentScript = (manifest.content_scripts || []).find((cs) => (cs.js || []).includes('content-app.js'));
  if (appContentScript?.matches) lists.push(['content_scripts.matches', appContentScript.matches]);
  if (appContentScript?.exclude_matches) lists.push(['content_scripts.exclude_matches', appContentScript.exclude_matches]);
  // exclude_matches lives on the site content script too
  const siteScript = (manifest.content_scripts || []).find((cs) => (cs.js || []).includes('content-site.js'));
  if (siteScript?.exclude_matches) lists.push(['content-site.exclude_matches', siteScript.exclude_matches]);
  for (const war of manifest.web_accessible_resources || []) {
    if (war.matches) lists.push(['web_accessible_resources.matches', war.matches]);
  }
  return lists;
}

describe('extension manifest', () => {
  it('is a valid MV3 manifest', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBe('background.js');
  });

  it('never trusts a wildcard-subdomain app origin (CRITICAL regression guard)', () => {
    for (const [name, list] of appOriginLists()) {
      for (const pattern of list) {
        // No "*.something.tld" host patterns in any app-origin trust list.
        expect(pattern, `${name} contains a wildcard-subdomain origin: ${pattern}`).not.toMatch(/:\/\/\*\./);
        expect(pattern, `${name} still references *.vercel.app`).not.toContain('*.vercel.app');
      }
    }
  });

  it('exposes inpage.js only to specific app origins, not <all_urls>', () => {
    for (const war of manifest.web_accessible_resources || []) {
      expect(war.matches).toBeTruthy();
      expect(war.matches).not.toContain('<all_urls>');
    }
  });
});
