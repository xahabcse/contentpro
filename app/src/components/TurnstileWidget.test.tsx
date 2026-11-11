// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
  vi.resetModules();
  window.turnstile = undefined;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  document.querySelectorAll(`script[src="${SCRIPT_URL}"]`).forEach((script) => script.remove());
  window.turnstile = undefined;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('TurnstileWidget script failure', () => {
  it('stops waiting, explains the failure, and retries without losing the form', async () => {
    const { default: TurnstileWidget } = await import('./TurnstileWidget');
    const onToken = vi.fn();
    act(() => { root.render(<TurnstileWidget token="" onToken={onToken} />); });

    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading security check');
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not load');

    const firstScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    const retryButton = host.querySelector<HTMLButtonElement>('button');
    expect(retryButton?.textContent).toBe('Retry security check');
    act(() => { retryButton?.click(); });
    expect(document.querySelector(`script[src="${SCRIPT_URL}"]`)).not.toBe(firstScript);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading security check');

    const renderWidget = vi.fn().mockReturnValue('widget-1');
    window.turnstile = { render: renderWidget, remove: vi.fn(), reset: vi.fn() };
    act(() => { vi.advanceTimersByTime(100); });
    expect(renderWidget).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="alert"]')).toBeNull();

    act(() => { renderWidget.mock.calls[0][1].callback('verified-token'); });
    expect(onToken).toHaveBeenCalledWith('verified-token');
  });

  it('offers a retry when the loaded challenge reports an error', async () => {
    const { default: TurnstileWidget } = await import('./TurnstileWidget');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 223, 80));
    const renderWidget = vi.fn().mockReturnValue('widget-1');
    const removeWidget = vi.fn();
    window.turnstile = { render: renderWidget, remove: removeWidget, reset: vi.fn() };
    const onToken = vi.fn();
    act(() => { root.render(<TurnstileWidget token="" onToken={onToken} />); });
    act(() => { vi.advanceTimersByTime(0); });
    expect(renderWidget.mock.calls[0][1].size).toBe('compact');

    act(() => { renderWidget.mock.calls[0][1]['error-callback'](); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('security check failed');
    act(() => { host.querySelector<HTMLButtonElement>('button')?.click(); });
    act(() => { vi.advanceTimersByTime(0); });

    expect(removeWidget).toHaveBeenCalledWith('widget-1');
    expect(renderWidget).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
