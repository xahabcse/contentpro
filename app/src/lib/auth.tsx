import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: {
    name?: string;
    designation?: string;
    companyName?: string;
    handle?: string;
  };
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

// Session lives in an httpOnly cookie set by the Worker (per
// docs/contentpro-spec.md §5.2) -- the frontend never reads/stores the JWT
// itself, it just calls /api/auth/me and lets the cookie ride along
// (fetch credentials: 'include').
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
