import { webcrypto } from 'node:crypto';
import { beforeEach } from 'vitest';

// jsdom does not ship a full WebCrypto in older versions. Polyfill from Node.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

// Reset localStorage between tests so vault/consent state doesn't leak.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
