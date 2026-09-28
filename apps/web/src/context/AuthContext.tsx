import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../api/client";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: "EMPLOYEE" | "ADMIN";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromToken = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<{ user: AuthUser }>("/api/me");
      setUser(me.user);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromToken();
  }, [loadFromToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", { email, password });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/register", { email, password, displayName });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
