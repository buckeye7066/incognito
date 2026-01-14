import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('UI never references raw PAN/CVV fields', async () => {
  const ui = await read('src/components/monitoring/QuickGenerateCard.jsx');
  assert.ok(!/generatedCard\.cvv\b/.test(ui), 'QuickGenerateCard must not reference generatedCard.cvv');
  assert.ok(!/generatedCard\.pan\b/.test(ui), 'QuickGenerateCard must not reference generatedCard.pan');
});

test('Virtual card function never returns raw PAN/CVV keys', async () => {
  const fn = await read('functions/generateVirtualCard.ts');
  assert.ok(!/\.cvv\b/.test(fn), 'generateVirtualCard.ts must not access .cvv');
  assert.ok(!/\bcvv\s*:/.test(fn), 'generateVirtualCard.ts must not return a cvv field');
  assert.ok(!/\.pan\b/.test(fn), 'generateVirtualCard.ts must not access .pan');
  assert.ok(!/\bpan\s*:/.test(fn), 'generateVirtualCard.ts must not return a pan field');
  assert.ok(/\bmasked_pan\b/.test(fn), 'generateVirtualCard.ts should return masked_pan');
});

test('PII-safe logging: monitorEmails/checkBreaches do not log raw identifiers', async () => {
  const monitorEmails = await read('functions/monitorEmails.ts');
  assert.ok(monitorEmails.includes('redactForLog'), 'monitorEmails.ts should use redactForLog');
  assert.ok(!/Error monitoring \$\{account\.account_identifier\}/.test(monitorEmails), 'monitorEmails.ts must not log raw account_identifier');

  const checkBreaches = await read('functions/checkBreaches.ts');
  assert.ok(checkBreaches.includes('redactForLog'), 'checkBreaches.ts should use redactForLog');
  assert.ok(!/Error checking \\$\\{value\\}/.test(checkBreaches), 'checkBreaches.ts must not log raw identifier value');
});

