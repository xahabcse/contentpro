import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ToastProvider from './components/ui/ToastProvider';
import { AuthProvider } from './lib/auth';
import './styles/tokens.css';
import './styles/studio.css';
import { applyInitialSky } from './lib/sky';
import { clearChunkReloadFlag, reloadOnceForNewBuild } from './lib/chunk-reload';

applyInitialSky();

// A tab left open across a deploy asks for chunk names the new build doesn't
// have. Vite reports that here; reload once to get the new build instead of
// failing the page. ErrorBoundary covers the same case if it reaches React.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewBuild()) event.preventDefault();
});
// This load worked, so a later stale-chunk failure may reload again.
window.addEventListener('load', () => setTimeout(clearChunkReloadFlag, 10_000));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
