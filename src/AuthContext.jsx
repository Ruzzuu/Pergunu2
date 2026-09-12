import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const result = await api('/api/auth/me');
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refresh,
    login: async (identifier, password, turnstileToken) => {
      const result = await api('/api/auth/login', { json: { identifier, password, turnstileToken } });
      setUser(result.user);
      return result.user;
    },
    logout: async () => {
      await api('/api/auth/logout', { method: 'POST', json: {} });
      setUser(null);
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
