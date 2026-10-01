import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  SESSION_EXPIRED_EVENT,
  clearTokens,
  getAccessToken,
  getMe,
  loginDoctor,
  logoutDoctor,
  setTokens,
  type Me,
} from "../services/api";

/** Por qué no hay sesión: la cerró el usuario o venció (en ese caso se vuelve a la página donde estaba). */
export type SessionEnd = "logout" | "expired" | null;

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  sessionEnd: SessionEnd;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(() => !!getAccessToken());
  const [sessionEnd, setSessionEnd] = useState<SessionEnd>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    getMe()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleExpired() {
      setSessionEnd("expired");
      setUser(null);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  async function login(username: string, password: string) {
    const { access, refresh } = await loginDoctor(username, password);
    setTokens(access, refresh);
    const me = await getMe();
    setSessionEnd(null);
    setUser(me);
  }

  async function logout() {
    await logoutDoctor();
    setSessionEnd("logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionEnd, login, logout }}>
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
