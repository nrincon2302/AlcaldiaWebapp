import React, { createContext, useContext, useMemo, useState } from "react";
import { API_URL } from "../lib/api";
import { setToken, getUser, logout as _logout } from "../lib/auth";

type AuthCtx = {
  user: ReturnType<typeof getUser>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(getUser());

  async function login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${API_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!res.ok) throw new Error("Credenciales inválidas");
    const data = await res.json();
    setToken(data.access_token);
    setUser(getUser());
  }

  function logout() {
    _logout();
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
