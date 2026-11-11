// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth';
import { useAuth } from './auth-context';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const signedIn = {
  id: 'user-1', email: 'alice@example.test', emailVerified: true, profile: {},
};

function meResponse(user = signedIn): Response {
  return { ok: true, json: async () => user } as Response;
}

function Probe({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return <span>{auth.loading ? 'loading' : auth.user?.email ?? 'signed-out'}</span>;
}

let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('AuthProvider request ordering', () => {
  it('ignores a stale initial /me response after login refresh succeeds', async () => {
    const initial = deferred<Response>();
    const refreshed = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => refreshed.promise));
    const container = document.createElement('div');
    document.body.append(container);
    let auth!: ReturnType<typeof useAuth>;
    root = createRoot(container);
    await act(async () => root!.render(<AuthProvider><Probe onAuth={(value) => { auth = value; }} /></AuthProvider>));
    expect(container.textContent).toBe('loading');

    let refreshTask!: Promise<void>;
    await act(async () => { refreshTask = auth.refresh(); });
    await act(async () => { refreshed.resolve(meResponse()); await refreshTask; });
    expect(container.textContent).toBe('alice@example.test');

    await act(async () => { initial.resolve({ ok: false } as Response); await initial.promise; });
    expect(container.textContent).toBe('alice@example.test');
  });

  it('ignores a stale initial /me response after logout', async () => {
    const initial = deferred<Response>();
    const logoutResponse = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => logoutResponse.promise));
    const container = document.createElement('div');
    document.body.append(container);
    let auth!: ReturnType<typeof useAuth>;
    root = createRoot(container);
    await act(async () => root!.render(<AuthProvider><Probe onAuth={(value) => { auth = value; }} /></AuthProvider>));

    let logoutTask!: Promise<void>;
    await act(async () => { logoutTask = auth.logout(); });
    await act(async () => { logoutResponse.resolve({ ok: true } as Response); await logoutTask; });
    expect(container.textContent).toBe('signed-out');

    await act(async () => { initial.resolve(meResponse()); await initial.promise; });
    expect(container.textContent).toBe('signed-out');
  });
});
