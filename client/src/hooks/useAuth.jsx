import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);
export const ME_KEY = ['me'];

/**
 * The session lives in an httpOnly cookie the JS can't read, so "who am I" is asked
 * of the server (GET /api/auth/me) and cached by TanStack Query under ['me'].
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isPending } = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api('/api/auth/me').then((d) => d.user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const value = useMemo(() => {
    const startSession = (u) => {
      // Drop anything cached for the previous user, then publish the new identity.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      queryClient.setQueryData(ME_KEY, u);
      return u;
    };
    return {
      user: user ?? null,
      isLoading: isPending,
      login: (email, password) =>
        api('/api/auth/login', { method: 'POST', body: { email, password } }).then((d) => startSession(d.user)),
      register: (fields) => api('/api/auth/register', { method: 'POST', body: fields }).then((d) => startSession(d.user)),
      logout: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        startSession(null);
      },
      setUser: (u) => queryClient.setQueryData(ME_KEY, u),
    };
  }, [user, isPending, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
