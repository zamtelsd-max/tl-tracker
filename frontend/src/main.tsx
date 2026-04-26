import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

// ── Auto-update: check for new deploy every 5 min ─────────────────────────
const BUILD_TS = import.meta.env.VITE_BUILD_TS ?? '';
let _lastEtag = '';
async function checkForUpdate() {
  try {
    const r = await fetch(window.location.pathname.endsWith('/') ? '.' : './', {
      method: 'HEAD',
      cache: 'no-store',
    });
    const etag = r.headers.get('etag') ?? r.headers.get('last-modified') ?? '';
    if (_lastEtag && etag && etag !== _lastEtag) {
      console.info('[TL Tracker] New version detected — reloading');
      window.location.reload();
    }
    _lastEtag = etag || _lastEtag;
  } catch {
    // network error — ignore
  }
}
// Initial check after 10s (let the page settle), then every 5 min
setTimeout(() => { void checkForUpdate(); }, 10_000);
setInterval(() => { void checkForUpdate(); }, 5 * 60 * 1000);
// Also check on tab focus
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForUpdate();
});
if (BUILD_TS) console.info('[TL Tracker] Build:', BUILD_TS);
// ──────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
