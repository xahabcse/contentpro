// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileSettingsPage from './ProfileSettingsPage';

vi.mock('@/components/layout/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/ui/SkySwitch', () => ({ default: () => null }));
vi.mock('@/components/editor/SlidePreview', () => ({
  default: ({ footer }: { footer: { name: string; handle: string } }) => <output>{`${footer.name} @${footer.handle}`}</output>,
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ refresh: async () => {} }) }));
vi.mock('@/lib/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderWithProfile(body: unknown): Promise<HTMLElement> {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body }) as Response));
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<MemoryRouter><ProfileSettingsPage /></MemoryRouter>));
  return container;
}

describe('ProfileSettingsPage', () => {
  it('renders the form for an account that has never saved its profile', async () => {
    // GET /api/profile drops every NULL column, so a fresh account gets only the image fields.
    const container = await renderWithProfile({ photoUrl: null, companyLogoUrl: null });

    expect(container.querySelector<HTMLInputElement>('#name')?.value).toBe('');
    expect(container.querySelector<HTMLInputElement>('#handle')?.value).toBe('');
    expect(container.querySelector('output')?.textContent).toBe('Your name @yourhandle');
  });

  it('fills the form from a saved profile', async () => {
    const container = await renderWithProfile({
      name: 'Alice Example', designation: 'Engineer', companyName: 'Acme', handle: '@alice',
      photoUrl: null, companyLogoUrl: null,
    });

    expect(container.querySelector<HTMLInputElement>('#name')?.value).toBe('Alice Example');
    expect(container.querySelector<HTMLInputElement>('#handle')?.value).toBe('alice');
  });
});
