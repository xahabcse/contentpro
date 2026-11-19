import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailNoticePage from './pages/VerifyEmailNoticePage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProtectedRoute from './components/layout/ProtectedRoute';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <>
    <div className="sky" aria-hidden="true" />
    <Suspense fallback={<div role="status" style={{ padding: 32, textAlign: 'center' }}>Loading…</div>}>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailNoticePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
        <Route path="/designs/:id" element={<EditorPage />} />
      </Route>

      {/* The admin moved to admin.xahabcse.me; the old address is a plain 404. */}
      <Route path="/admin/*" element={<NotFoundPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}
