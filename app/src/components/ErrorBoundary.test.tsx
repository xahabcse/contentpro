// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function Broken(): never {
  throw new Error('render failed');
}

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(node));
  return container;
}

describe('ErrorBoundary', () => {
  it('shows a reload message instead of a blank page when a page throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = await render(<ErrorBoundary resetKey="/a"><Broken /></ErrorBoundary>);

    expect(container.querySelector('[role=alert]')?.textContent).toContain('Something went wrong.');
    expect(container.querySelector('button')?.textContent).toBe('Reload page');
  });

  it('clears the error when the page changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = await render(<ErrorBoundary resetKey="/a"><Broken /></ErrorBoundary>);
    expect(container.querySelector('[role=alert]')).not.toBeNull();

    await act(async () => root!.render(<ErrorBoundary resetKey="/b"><p>Next page</p></ErrorBoundary>));
    expect(container.textContent).toBe('Next page');
  });
});
