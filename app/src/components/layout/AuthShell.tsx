import type { ReactNode } from 'react';
import { CardstockLogo } from '@/components/Logo';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// Centered single-column auth card: mobile-first stacked content, generous
// rounded corners, one primary action -- not a two-column desktop layout.
export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div className="card-surface" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ marginBottom: 18 }}>
          <CardstockLogo size={30} wordSize={19} color="var(--ink)" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px 0' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px 0' }}>{subtitle}</p>
        )}
        {children}
      </div>

      <footer style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>
          © 2026{' '}
          <a href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>xahabcse.me</a>
        </span>
      </footer>
    </div>
  );
}
