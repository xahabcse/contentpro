import { createContext, useContext } from 'react';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: {
    name?: string;
    designation?: string;
    companyName?: string;
    handle?: string;
    // The authenticated image routes (/api/profile/photo|logo), or null when none is uploaded.
    photoUrl?: string | null;
    companyLogoUrl?: string | null;
  };
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
