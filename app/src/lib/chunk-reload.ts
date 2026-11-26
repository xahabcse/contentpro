const CHUNK_RELOAD_KEY = 'cardstock.chunk-reload';

// A page whose code-split chunk can't be loaded -- usually a tab left open across
// a deploy, asking for a file name the new build no longer has.
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(message);
}

// Reload once to pick up the new build. The session flag stops a loop when the
// chunk is missing for some other reason.
export function reloadOnceForNewBuild(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag() {
  try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage blocked */ }
}
