import { useState, useEffect, useCallback } from 'react';
import vault from '@/lib/vault';
import { getAllCapabilityStatuses, getAllProviderStatuses } from '@/providers';

/**
 * React access to the provider registry's live capability/status model.
 *
 * Re-reads whenever the vault locks/unlocks (because secret availability — and
 * therefore many statuses — changes) and exposes a manual refresh() for after
 * a key is saved or consent is changed.
 */
function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState(() => safe(getAllCapabilityStatuses, {}));
  const [providers, setProviders] = useState(() => safe(getAllProviderStatuses, {}));

  const refresh = useCallback(() => {
    setCapabilities(safe(getAllCapabilityStatuses, {}));
    setProviders(safe(getAllProviderStatuses, {}));
  }, []);

  useEffect(() => {
    const offUnlock = vault.on('unlock', refresh);
    const offLock = vault.on('lock', refresh);
    refresh();
    return () => {
      if (typeof offUnlock === 'function') offUnlock();
      if (typeof offLock === 'function') offLock();
    };
  }, [refresh]);

  return { capabilities, providers, refresh };
}

export default useCapabilities;
