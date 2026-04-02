import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { incognito } from '@/api/client';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const initLocalAuth = useCallback(async () => {
    try {
      const currentUser = await incognito.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth init failed:', error);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    initLocalAuth();
  }, [initLocalAuth]);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const login = useCallback(() => {
    setIsLoadingAuth(true);
    queryClientInstance.invalidateQueries({ queryKey: ['profiles'] });
    queryClientInstance.invalidateQueries({ queryKey: ['personalData'] });
    initLocalAuth();
  }, [initLocalAuth]);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    login,
    logout,
    checkAppState: initLocalAuth,
  }), [user, isAuthenticated, isLoadingAuth, login, logout, initLocalAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { user: null, isAuthenticated: false, isLoadingAuth: false, login: () => {}, logout: () => {}, checkAppState: () => {} };
  }
  return context;
};
