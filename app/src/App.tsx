import { Routes, Route, Navigate } from 'react-router-dom';
import SignupPage from './pages/SignupPage';
import VerifyEmailNoticePage from './pages/VerifyEmailNoticePage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import CardEditorPage from './pages/CardEditorPage';
import CarouselEditorPage from './pages/CarouselEditorPage';
import ProtectedRoute from './components/layout/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailNoticePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
        <Route path="/designs/card/:id" element={<CardEditorPage />} />
        <Route path="/designs/carousel/:id" element={<CarouselEditorPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
