import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ActiveProfileContext = createContext(null);

export function ActiveProfileProvider({ children }) {
  const [activeProfileId, setActiveProfileIdState] = useState(() => {
    return localStorage.getItem('activeProfileId') || null;
  });

  const setActiveProfileId = useCallback((id) => {
    localStorage.setItem('activeProfileId', id);
    setActiveProfileIdState(id);
  }, []);

  const value = useMemo(() => ({ activeProfileId, setActiveProfileId }), [activeProfileId, setActiveProfileId]);

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    return { activeProfileId: localStorage.getItem('activeProfileId') || null, setActiveProfileId: () => {} };
  }
  return ctx;
}
