import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;

  return <Outlet />;
}
