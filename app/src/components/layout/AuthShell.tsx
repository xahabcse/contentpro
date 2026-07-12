import type { ReactNode } from 'react';

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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div className="card-surface" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div className="pill pill-brand" style={{ marginBottom: 16 }}>
          <span>ContentPro</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px 0' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px 0' }}>{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}
