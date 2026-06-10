import { describe, it, expect, beforeEach } from 'vitest';
import {
  CAPABILITY_STATUS,
  computeProviderStatus,
  bestStatus,
  isUsable,
} from '@/providers/capabilities.js';

// Re-import client fresh so the singleton vault tracks cleared localStorage.
async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}

// ─────────────────────────────────────────────────────────────────────────
// Pure capability/status logic (no app imports, no network)
// ─────────────────────────────────────────────────────────────────────────
describe('computeProviderStatus (pure)', () => {
  const emailProvider = {
    id: 'simplelogin',
    requiredSecrets: ['simplelogin_api_key'],
    requiredConsentDataTypes: ['email'],
  };

  it('needs_provider with missingSecrets when keys absent (vault unlocked)', () => {
    const r = computeProviderStatus(emailProvider, {
      keys: {}, vaultLocked: false, isAllowed: () => true,
    });
    expect(r.status).toBe(CAPABILITY_STATUS.NEEDS_PROVIDER);
    expect(r.detail.missingSecrets).toContain('simplelogin_api_key');
  });

  it('needs_provider + locked flag when vault is locked and secrets are required', () => {
    const r = computeProviderStatus(emailProvider, {
      keys: {}, vaultLocked: true, isAllowed: () => true,
    });
    expect(r.status).toBe(CAPABILITY_STATUS.NEEDS_PROVIDER);
    expect(r.detail.locked).toBe(true);
  });

  it('needs_provider when keys present but consent missing', () => {
    const r = computeProviderStatus(emailProvider, {
      keys: { simplelogin_api_key: 'k' }, vaultLocked: false, isAllowed: () => false,
    });
    expect(r.status).toBe(CAPABILITY_STATUS.NEEDS_PROVIDER);
    expect(r.detail.missingConsent).toContain('email');
  });

  it('ready when keys present and consent granted', () => {
    const r = computeProviderStatus(emailProvider, {
      keys: { simplelogin_api_key: 'k' }, vaultLocked: false, isAllowed: () => true,
    });
    expect(r.status).toBe(CAPABILITY_STATUS.READY);
  });

  it('infrastructure prerequisites win over secrets', () => {
    const native = { id: 'n', requiresNativeBridge: true, requiredSecrets: [] };
    expect(computeProviderStatus(native, { hasNativeBridge: false }).status)
      .toBe(CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE);

    const backend = { id: 'b', requiresBackend: true, requiredSecrets: [] };
    expect(computeProviderStatus(backend, { hasBackend: false }).status)
      .toBe(CAPABILITY_STATUS.NEEDS_BACKEND);

    const ext = { id: 'e', requiresBrowserExtension: true, requiredSecrets: [] };
    expect(computeProviderStatus(ext, { hasExtensionBridge: false }).status)
      .toBe(CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION);
  });

  it('mock_only and disabled are reported honestly', () => {
    expect(computeProviderStatus({ id: 'm', mockOnly: true }).status).toBe(CAPABILITY_STATUS.MOCK_ONLY);
    expect(computeProviderStatus({ id: 'd', disabled: true }).status).toBe(CAPABILITY_STATUS.DISABLED);
  });

  it('bestStatus prefers ready over warnings; isUsable matches', () => {
    expect(bestStatus([CAPABILITY_STATUS.NEEDS_PROVIDER, CAPABILITY_STATUS.READY])).toBe(CAPABILITY_STATUS.READY);
    expect(bestStatus([])).toBe(CAPABILITY_STATUS.MANUAL_ONLY);
    expect(isUsable(CAPABILITY_STATUS.READY)).toBe(true);
    expect(isUsable(CAPABILITY_STATUS.MANUAL_ONLY)).toBe(true);
    expect(isUsable(CAPABILITY_STATUS.NEEDS_PROVIDER)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Provider registry with real context
// ─────────────────────────────────────────────────────────────────────────
describe('provider registry', () => {
  beforeEach(async () => {
    localStorage.clear();
    await freshClient();
  });

  it('lists providers and every one declares the full contract', async () => {
    const { listProviders } = await import('@/providers/index.js');
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(5);
    for (const p of providers) {
      expect(typeof p.id).toBe('string');
      expect(Array.isArray(p.capabilities)).toBe(true);
      expect(Array.isArray(p.requiredSecrets)).toBe(true);
      expect(typeof p.requiresBackend).toBe('boolean');
      expect(typeof p.requiresNativeBridge).toBe('boolean');
      expect(typeof p.requiresBrowserExtension).toBe('boolean');
      expect(typeof p.testConnection).toBe('function');
      expect(typeof p.invoke).toBe('function');
    }
  });

  it('VPN config is ready locally; VPN connect needs a native bridge', async () => {
    const { getCapabilityStatus, CAPABILITY } = await import('@/providers/index.js');
    expect(getCapabilityStatus(CAPABILITY.VPN_CONFIG).status).toBe(CAPABILITY_STATUS.READY);
    expect(getCapabilityStatus(CAPABILITY.VPN_CONNECT).status).toBe(CAPABILITY_STATUS.NEEDS_NATIVE_BRIDGE);
  });

  it('a capability with no provider is manual_only, not faked ready', async () => {
    const { getCapabilityStatus } = await import('@/providers/index.js');
    // A capability nothing contributes to must degrade to an honest manual flow.
    expect(getCapabilityStatus('__no_such_capability__').status).toBe(CAPABILITY_STATUS.MANUAL_ONLY);
  });

  it('autofill needs the browser extension, not a fake "ready"', async () => {
    const { getCapabilityStatus, CAPABILITY } = await import('@/providers/index.js');
    // No companion extension is present under test, so the honest answer is
    // "needs browser extension" — never READY and never a false MANUAL_ONLY.
    expect(getCapabilityStatus(CAPABILITY.AUTOFILL).status)
      .toBe(CAPABILITY_STATUS.NEEDS_BROWSER_EXTENSION);
  });

  it('email alias needs a provider when nothing is configured', async () => {
    const { getCapabilityStatus, CAPABILITY } = await import('@/providers/index.js');
    const r = getCapabilityStatus(CAPABILITY.EMAIL_ALIAS);
    expect(r.status).toBe(CAPABILITY_STATUS.NEEDS_PROVIDER);
  });

  it('optional backend is off by default and toggleable', async () => {
    const { getBackendUrl, setBackendUrl } = await import('@/providers/index.js');
    expect(getBackendUrl()).toBeNull();
    setBackendUrl('http://localhost:8787');
    expect(getBackendUrl()).toBe('http://localhost:8787');
    setBackendUrl(null);
    expect(getBackendUrl()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// New family entities — sensitive fields encrypted at rest + redacted on lock
// ─────────────────────────────────────────────────────────────────────────
describe('family entities encryption + redaction', () => {
  let client;
  let vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
  });

  it('registers the new sensitive entities', async () => {
    const names = client.getSensitiveEntityNames();
    expect(names).toEqual(
      expect.arrayContaining([
        'HouseholdMember', 'PrivacyTask', 'EvidenceItem',
        'SharedVaultItem', 'IdentityMessage', 'RecoveryPacket',
      ]),
    );
  });

  it('HouseholdMember encrypts ssn/dob/notes at rest and decrypts when unlocked', async () => {
    await vault.init('correct horse battery staple');
    const member = await client.default.entities.HouseholdMember.create({
      display_name: 'Kiddo',
      role: 'child',
      ssn: '000-00-0000',
      date_of_birth: '2015-01-01',
      notes: 'private',
    });
    expect(member.ssn).toBe('000-00-0000');
    expect(member.display_name).toBe('Kiddo');

    const raw = JSON.parse(localStorage.getItem('incognito_entity_HouseholdMember'));
    const blob = JSON.stringify(raw);
    expect(blob).not.toContain('000-00-0000');
    expect(blob).not.toContain('2015-01-01');
    expect(blob).not.toContain('private');
    // Non-sensitive grouping field stays queryable in plaintext.
    expect(raw[0].display_name).toBe('Kiddo');
    expect(raw[0].ssn).toMatchObject({ iv: expect.any(String), ct: expect.any(String) });
  });

  it('locked read redacts HouseholdMember secrets but keeps grouping fields', async () => {
    await vault.init('correct horse battery staple');
    await client.default.entities.HouseholdMember.create({
      display_name: 'Spouse', role: 'spouse', ssn: '000-00-0000',
    });
    vault.lock();
    const list = await client.default.entities.HouseholdMember.list();
    expect(list[0].display_name).toBe('Spouse');
    expect(list[0].ssn).toBeNull();
    expect(list[0].__locked).toBe(true);
  });

  it('PrivacyTask keeps status queryable but encrypts the payload', async () => {
    await vault.init('correct horse battery staple');
    const task = await client.default.entities.PrivacyTask.create({
      type: 'broker_removal',
      title: 'Remove from Spokeo',
      status: 'queued',
      encrypted_payload: JSON.stringify({ address: '1 Private Lane' }),
    });
    expect(task.status).toBe('queued');
    const raw = JSON.parse(localStorage.getItem('incognito_entity_PrivacyTask'));
    expect(raw[0].status).toBe('queued');
    expect(JSON.stringify(raw)).not.toContain('1 Private Lane');
  });

  it('Household (non-sensitive) creates without an unlocked vault', async () => {
    const hh = await client.default.entities.Household.create({ name: 'The Firers' });
    expect(hh.name).toBe('The Firers');
    const list = await client.default.entities.Household.list();
    expect(list).toHaveLength(1);
  });

  it('importPasswords parses robustly, encrypts, and dedupes on re-import', async () => {
    await vault.init('correct horse battery staple');
    const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
,,login,GitHub,,,0,https://github.com,me@example.com,s3cret,
,,login,Bank,,,0,https://bank.example.com,user1,p@ss,
`;
    const first = await client.default.functions.invoke('importPasswords', { csvData: csv, source: 'bitwarden' });
    expect(first.data.imported).toBe(2);

    // Passwords are encrypted at rest, decrypted on list.
    const raw = JSON.stringify(JSON.parse(localStorage.getItem('incognito_entity_PasswordEntry')));
    expect(raw).not.toContain('s3cret');
    const list = await client.default.entities.PasswordEntry.list();
    expect(list.find((p) => p.service_name === 'GitHub').password).toBe('s3cret');

    // Re-import the same file → everything is a duplicate, nothing re-created.
    const second = await client.default.functions.invoke('importPasswords', { csvData: csv, source: 'bitwarden' });
    expect(second.data.imported).toBe(0);
    expect(second.data.duplicates).toBe(2);
  });
});
