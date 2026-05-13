"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@/types/user";
import { getToken, setToken as saveToken, clearToken } from "@/lib/authStore";
import { login as apiLogin, register as apiRegister, getCurrentUser, logout as apiLogout } from "@/lib/authApi";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = getToken();
    if (saved) {
      setTokenState(saved);
      getCurrentUser()
        .then(setUser)
        .catch(() => {
          clearToken();
          setTokenState(null);
          document.cookie = "auth_status=; path=/; max-age=0";
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin({ username, password });
    saveToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
    document.cookie = "auth_status=1; path=/; max-age=604800; SameSite=Lax";
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await apiRegister({ username, email, password });
    saveToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
    document.cookie = "auth_status=1; path=/; max-age=604800; SameSite=Lax";
  }, []);

  const logout = useCallback(() => {
    apiLogout().catch(() => { /* 即使服务端登出失败也清除本地状态 */ });
    clearToken();
    setTokenState(null);
    setUser(null);
    document.cookie = "auth_status=; path=/; max-age=0";
  }, []);

  const refreshUser = useCallback(async () => {
    try { setUser(await getCurrentUser()); } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
