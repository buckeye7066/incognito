import { webcrypto } from 'node:crypto';
import { beforeEach } from 'vitest';

// jsdom does not ship a full WebCrypto in older versions. Polyfill from Node.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

// A privacy app's tests must make NO real outbound calls. Stub fetch so the
// best-effort breach-list prefetch (and any accidental network in a test)
// fails fast and offline instead of hitting the wire. Individual tests that
// need a specific response can override globalThis.fetch.
if (typeof globalThis.fetch !== 'function' || !globalThis.fetch.__incognitoStub) {
  const stub = () => Promise.reject(new Error('network disabled in tests'));
  stub.__incognitoStub = true;
  globalThis.fetch = stub;
}

// Reset localStorage between tests so vault/consent state doesn't leak.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
