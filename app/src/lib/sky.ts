import { useSyncExternalStore } from 'react';

// The "sky" is the app's light/dark theme (Studio Glass, design/README.md):
// day = warm paper, night = the studio after hours. The viewer's own choice is
// remembered in this browser; without one, the Dhaka clock picks (day 07-18).
export type Sky = 'day' | 'night';

const STORAGE_KEY = 'cardstock.sky';
const EVENT = 'cardstock:sky';

function fromClock(): Sky {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(new Date()));

  return hour >= 7 && hour < 18 ? 'day' : 'night';
}

function stored(): Sky | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return value === 'day' || value === 'night' ? value : null;
  } catch {
    return null;
  }
}

export function currentSky(): Sky {
  const value = document.documentElement.dataset.sky;

  return value === 'night' ? 'night' : 'day';
}

// Runs once in main.tsx before React renders, so the page never flashes the
// wrong sky. (The CSP forbids inline scripts, so this cannot live in index.html.)
export function applyInitialSky(): void {
  document.documentElement.dataset.sky = stored() ?? fromClock();
}

export function setSky(sky: Sky): void {
  document.documentElement.dataset.sky = sky;
  try {
    localStorage.setItem(STORAGE_KEY, sky);
  } catch {
    // Private mode or blocked storage: the sky still changes for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);

  return () => window.removeEventListener(EVENT, onChange);
}

export function useSky(): [Sky, (sky: Sky) => void] {
  const sky = useSyncExternalStore(subscribe, currentSky, () => 'day' as Sky);

  return [sky, setSky];
}
