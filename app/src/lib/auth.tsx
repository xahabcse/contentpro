import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext, type User } from './auth-context';

// Session lives in an httpOnly cookie set by the Worker (per
// docs/contentpro-spec.md §5.2) -- the frontend never reads/stores the JWT
// itself, it just calls /api/auth/me and lets the cookie ride along
// (fetch credentials: 'include').
async function loadCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    return res.ok ? await res.json() as User : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // The mount-time /me request may finish after a later login refresh or
  // logout. Only the latest auth operation may commit its result.
  const requestVersion = useRef(0);

  async function refresh() {
    const version = ++requestVersion.current;
    const current = await loadCurrentUser();
    if (version !== requestVersion.current) return;
    setUser(current);
    setLoading(false);
  }

  async function logout() {
    const version = ++requestVersion.current;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      // The earlier /me result was invalidated, so a failed logout must not
      // leave a protected route waiting forever for that response.
      if (version === requestVersion.current) setLoading(false);
      throw error;
    }
    // A /me request started while logout was in flight can still contain the
    // old cookie. Invalidate that response before clearing local auth state.
    ++requestVersion.current;
    setUser(null);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    void loadCurrentUser().then((current) => {
      if (!active || version !== requestVersion.current) return;
      setUser(current);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
