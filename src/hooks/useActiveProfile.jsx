import React, { createContext, useContext, useState } from 'react';

const ActiveProfileContext = createContext(null);

export function ActiveProfileProvider({ children }) {
  const [activeProfileId, setActiveProfileIdState] = useState(() => {
    return localStorage.getItem('activeProfileId') || null;
  });

  const setActiveProfileId = (id) => {
    localStorage.setItem('activeProfileId', id);
    setActiveProfileIdState(id);
  };

  return (
    <ActiveProfileContext.Provider value={{ activeProfileId, setActiveProfileId }}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error('useActiveProfile must be used within ActiveProfileProvider');
  }
  return ctx;
}
