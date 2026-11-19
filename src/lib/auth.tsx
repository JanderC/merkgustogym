import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, session, setUnauthorizedHandler, type SessionUser } from './api';
import { setMonedaRef, type Moneda } from './monedas';

interface AuthCtx {
  user: SessionUser | null;
  login: (usuario: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  gym: { nombre: string; slogan: string; moneda: string } | null;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(session.user);
  const [gym, setGym] = useState<AuthCtx['gym']>(null);
  const qc = useQueryClient();

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!user) return;
    api<{ nombre: string; slogan: string; moneda: string; monedaRef: Moneda }>('/config/publica')
      .then((g) => {
        setMonedaRef(g.monedaRef);
        setGym(g);
      })
      .catch(() => undefined);
  }, [user]);

  const login = useCallback(async (usuario: string, password: string) => {
    const r = await api<{ token: string; user: SessionUser }>('/auth/login', { body: { usuario, password } });
    session.save(r.token, r.user);
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(() => ({ user, login, logout, gym }), [user, login, logout, gym]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
