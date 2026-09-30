import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearTokens,
  getAccessToken,
  getMe,
  loginDoctor,
  logoutDoctor,
  setTokens,
  type Me,
} from "../services/api";

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(() => !!getAccessToken());

  useEffect(() => {
    if (!getAccessToken()) return;
    getMe()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const { access, refresh } = await loginDoctor(username, password);
    setTokens(access, refresh);
    const me = await getMe();
    setUser(me);
  }

  async function logout() {
    await logoutDoctor();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocado con su Provider, patrón estándar de contexto
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
