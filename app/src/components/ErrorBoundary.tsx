import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadOnceForNewBuild } from '@/lib/chunk-reload';

interface Props {
  children: ReactNode;
  // Changes on navigation; a new page starts without the previous page's error.
  resetKey?: string;
}
interface State { error: unknown }

// Without this, any error thrown while rendering unmounts the whole React tree
// and the person sees a blank page with no way forward.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error !== null) this.setState({ error: null });
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewBuild();
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '15vh auto 0', padding: '0 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong.</h1>
        <p style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
          This page hit an error. Reloading usually fixes it. Your designs are saved in this browser.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
