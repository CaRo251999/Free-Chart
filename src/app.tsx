import { useEffect } from 'preact/hooks';
import { extraPairs, layout, pair, route, sidebarOpen } from './state';
import { installShortcuts } from './ui/shortcuts';
import { startAlertEngine } from './alerts/engine';
import { lang, t } from './i18n';
import { Toolbar } from './ui/Toolbar';
import { ChartView } from './ui/ChartView';
import { WatchlistPanel } from './ui/WatchlistPanel';
import { ShareImport } from './ui/ShareImport';
import { Toasts } from './ui/toast';
import { Credits, Privacy, Terms } from './pages/Legal';

function Footer() {
  return (
    <footer class="footer">
      <span class="disclaimer">{t('disclaimer')}</span>
      <nav aria-label="Legal">
        <a href="#/terms">{t('terms')}</a>
        <a href="#/privacy">{t('privacy')}</a>
        <a href="#/credits">{t('credits')}</a>
      </nav>
    </footer>
  );
}

function Charts() {
  const n = layout.value;
  const extra = extraPairs.value;
  return (
    <div class={`charts n${n}`}>
      <ChartView pair={pair.value} primary />
      {Array.from({ length: n - 1 }, (_, i) => (
        <ChartView key={i} slot={i} pair={extra[i] ?? pair.value} compact />
      ))}
    </div>
  );
}

export function App() {
  void lang.value; // re-render everything on language change
  useEffect(() => {
    const offKeys = installShortcuts();
    const offAlerts = startAlertEngine();
    return () => {
      offKeys();
      offAlerts();
    };
  }, []);
  const r = route.value;
  const page = r === 'credits' ? <Credits /> : r === 'terms' ? <Terms /> : r === 'privacy' ? <Privacy /> : null;
  return (
    <div class="app">
      <Toolbar />
      <main class="main">
        {page ?? (
          <div class={`workspace${sidebarOpen.value ? ' with-sidebar' : ''}`}>
            <div class="chart-area">
              <Charts />
            </div>
            {sidebarOpen.value && <WatchlistPanel />}
          </div>
        )}
      </main>
      <Footer />
      <ShareImport />
      <Toasts />
    </div>
  );
}
