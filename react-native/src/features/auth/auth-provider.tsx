import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authApi } from '@/api/auth';
import { registerUnauthorizedHandler } from '@/api/client';
import { sessionStorage } from '@/storage/session-storage';
import type { AuthSession } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  const clearLocalSession = useCallback(async () => {
    await sessionStorage.clear();
    queryClient.clear();
    setSession(null);
    setStatus('anonymous');
  }, [queryClient]);

  useEffect(() => {
    void sessionStorage.get().then((stored) => {
      if (!stored || stored.expiresAt <= Date.now()) {
        void clearLocalSession();
        return;
      }
      setSession(stored);
      setStatus('authenticated');
    });
  }, [clearLocalSession]);

  useEffect(() => registerUnauthorizedHandler(() => void clearLocalSession()), [clearLocalSession]);

  useEffect(() => {
    if (!session?.expiresAt) return;
    const timeout = setTimeout(() => void clearLocalSession(), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [clearLocalSession, session?.expiresAt]);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await authApi.login(email, password);
    await sessionStorage.save(nextSession);
    queryClient.clear();
    setSession(nextSession);
    setStatus('authenticated');
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession]);

  const value = useMemo(() => ({ status, session, signIn, signOut }), [session, signIn, signOut, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
