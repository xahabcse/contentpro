import { Link } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';

// Shown for /admin, which used to be the Cardstock admin. That admin moved to
// admin.xahabcse.me (one admin for the portfolio, NewsPortal and Cardstock), so
// the old URL says plainly that nothing is here instead of quietly redirecting.
export default function NotFoundPage() {
  return (
    <AuthShell title="Page not found" subtitle="There is nothing at this address.">
      <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Go to Cardstock
      </Link>
    </AuthShell>
  );
}
