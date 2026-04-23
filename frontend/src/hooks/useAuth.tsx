import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { getCurrentUser, signIn, signUp, confirmSignUp, signOut, type AuthUser } from "../lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  confirm: (email: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (u) localStorage.setItem("id_token", u.token);
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await signIn(email, password);
    localStorage.setItem("id_token", u.token);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
  }, []);

  const confirm = useCallback(async (email: string, code: string) => {
    await confirmSignUp(email, code);
  }, []);

  const logout = useCallback(() => {
    signOut();
    localStorage.removeItem("id_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, confirm, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
