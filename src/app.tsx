import { pair, route, sidebarOpen } from './state';
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

export function App() {
  void lang.value; // re-render everything on language change
  const r = route.value;
  const page = r === 'credits' ? <Credits /> : r === 'terms' ? <Terms /> : r === 'privacy' ? <Privacy /> : null;
  return (
    <div class="app">
      <Toolbar />
      <main class="main">
        {page ?? (
          <div class={`workspace${sidebarOpen.value ? ' with-sidebar' : ''}`}>
            <div class="chart-area">
              <ChartView pair={pair.value} primary />
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
