"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, register as apiRegister, getMe } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: any | null;
  loading: boolean;
}

const AuthCtx = createContext<{
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, company: string) => Promise<void>;
  logout: () => void;
}>({ auth: { token: null, user: null, loading: true }, login: async () => {}, register: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, user: null, loading: true });

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      getMe(saved)
        .then((user) => setAuth({ token: saved, user, loading: false }))
        .catch(() => { localStorage.removeItem("token"); setAuth({ token: null, user: null, loading: false }); });
    } else {
      setAuth({ token: null, user: null, loading: false });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem("token", res.access_token);
    const user = await getMe(res.access_token);
    setAuth({ token: res.access_token, user, loading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, company: string) => {
    const res = await apiRegister(email, password, company);
    localStorage.setItem("token", res.access_token);
    const user = await getMe(res.access_token);
    setAuth({ token: res.access_token, user, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setAuth({ token: null, user: null, loading: false });
  }, []);

  return <AuthCtx.Provider value={{ auth, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
