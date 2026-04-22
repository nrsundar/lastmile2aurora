import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { getCurrentUser, signIn, signUp, confirmSignUp, signOut, type AuthUser } from "../lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  confirm: (email: string, code: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getCurrentUser().then(setUser).finally(() => setLoading(false)); }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try { const u = await signIn(email, password); localStorage.setItem("id_token", u.token); setUser(u); } catch (e: any) { setError(e.message); throw e; }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try { await signUp(email, password, name); } catch (e: any) { setError(e.message); throw e; }
  }, []);

  const confirm = useCallback(async (email: string, code: string) => {
    setError(null);
    try { await confirmSignUp(email, code); } catch (e: any) { setError(e.message); throw e; }
  }, []);

  const logout = useCallback(() => { signOut(); localStorage.removeItem("id_token"); setUser(null); }, []);
  const clearError = useCallback(() => setError(null), []);

  return <AuthContext.Provider value={{ user, loading, error, login, register, confirm, logout, clearError }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
