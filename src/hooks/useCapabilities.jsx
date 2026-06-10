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
    // The companion extension injects its bridge asynchronously; refresh when it
    // announces itself so AUTOFILL flips from "Needs extension" to "Ready".
    const onExt = () => refresh();
    if (typeof window !== 'undefined') window.addEventListener('incognito:extension-ready', onExt);
    refresh();
    return () => {
      if (typeof offUnlock === 'function') offUnlock();
      if (typeof offLock === 'function') offLock();
      if (typeof window !== 'undefined') window.removeEventListener('incognito:extension-ready', onExt);
    };
  }, [refresh]);

  return { capabilities, providers, refresh };
}

export default useCapabilities;
