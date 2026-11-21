import { useState } from 'preact/hooks';
import { chartType, comparePair, interval, layout, pair, preferenceFor, selectPair, setPreference, sidebarOpen, theme, type ChartType, type LayoutKind } from '../state';
import { lang, setLang, t } from '../i18n';
import { INTERVALS } from '../exchanges/intervals';
import { ADAPTERS, ALL_IDS, type Preference } from '../exchanges/registry';
import { pairKey } from '../exchanges/symbols';
import { SymbolSearch } from './SymbolSearch';
import { IndicatorPanel } from './IndicatorPanel';
import { AlertsPanel, BackupPanel, HelpPanel } from './ExtraPanels';
import { Modal } from './Modal';
import { modal } from './uiState';
import { takeScreenshot } from './screenshotAction';
import { indicators } from '../indicators/state';
import { activeAlertCount } from '../alerts/store';
import { load, save } from '../data/storage';
import type { ExchangeId } from '../exchanges/types';

const LABEL: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1D', '1w': '1S' };
const LABEL_EN: Record<string, string> = { ...LABEL, '1w': '1W' };
const TYPES: ChartType[] = ['candles', 'line', 'area', 'heikin'];
const LAYOUTS: [LayoutKind, string][] = [[1, '▢'], [2, '◫'], [4, '⊞']];

export function ExchangePicker({ compact }: { compact?: boolean }) {
  const [warn, setWarn] = useState<ExchangeId | null>(null);
  const current = preferenceFor(pair.value);

  const choose = (v: Preference) => {
    if (v !== 'auto' && ADAPTERS[v].usRestricted) {
      const acked = load<string[]>('usAck', []);
      if (!acked.includes(v)) return setWarn(v);
    }
    setPreference(pair.value, v);
  };

  return (
    <>
      <select
        class="select"
        aria-label={t('exchange')}
        value={current}
        title={`${t('exchange')} · ${pairKey(pair.value)}`}
        onChange={(e) => choose((e.target as HTMLSelectElement).value as Preference)}
      >
        <option value="auto">{compact ? t('auto') : `${t('exchange')}: ${t('auto')}`}</option>
        {ALL_IDS.map((id) => (
          <option key={id} value={id}>
            {ADAPTERS[id].name}
            {ADAPTERS[id].usRestricted ? ' ⚠' : ''}
          </option>
        ))}
      </select>
      {warn && (
        <Modal title={t('usWarningTitle')} onClose={() => setWarn(null)}>
          <p>
            <strong>{ADAPTERS[warn].name}:</strong> {t('usWarning')}
          </p>
          <div class="row end">
            <button class="btn" onClick={() => setWarn(null)}>{t('cancel')}</button>
            <button
              class="btn primary"
              onClick={() => {
                save('usAck', [...load<string[]>('usAck', []), warn]);
                setPreference(pair.value, warn);
                setWarn(null);
              }}
            >
              {t('accept')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const item = (label: string, fn: () => void) => (
    <button class="btn" role="menuitem" onClick={() => { setOpen(false); fn(); }}>{label}</button>
  );
  return (
    <div class="more">
      <button class="btn icon" aria-haspopup="menu" aria-expanded={open} aria-label={t('more')} title={t('more')} onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div class="more-menu" role="menu">
          {item(`📷 ${t('screenshot')}`, () => void takeScreenshot())}
          {item(`💾 ${t('backup')}`, () => (modal.value = 'backup'))}
          {item(`⌨ ${t('shortcuts')}`, () => (modal.value = 'help'))}
          <a class="btn" role="menuitem" href="#/credits" onClick={() => setOpen(false)}>{t('credits')}</a>
        </div>
      )}
    </div>
  );
}

export function Toolbar() {
  const labels = lang.value === 'en' ? LABEL_EN : LABEL;
  const m = modal.value;
  const close = () => (modal.value = null);
  const cmp = comparePair.value;
  return (
    <header class="toolbar">
      <a class="brand" href="#/" aria-label={t('appName')}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="24" height="24" />
        <span>{t('appName')}</span>
      </a>
      <button class="btn pair-btn" onClick={() => (modal.value = 'search')} aria-label={t('search')}>
        🔍 {pairKey(pair.value)}
      </button>
      <div class="seg" role="group" aria-label="Timeframe">
        {INTERVALS.map((i) => (
          <button key={i} class={`btn seg-btn${interval.value === i ? ' active' : ''}`} aria-pressed={interval.value === i} onClick={() => (interval.value = i)}>
            {labels[i]}
          </button>
        ))}
      </div>
      <select class="select" aria-label={t('chartType')} value={chartType.value} onChange={(e) => (chartType.value = (e.target as HTMLSelectElement).value as ChartType)}>
        {TYPES.map((k) => (
          <option key={k} value={k}>{t(k)}</option>
        ))}
      </select>
      <button class="btn" onClick={() => (modal.value = 'indicators')} aria-label={t('indicators')}>ƒx {t('indicators')}{indicators.value.length ? ` (${indicators.value.length})` : ''}</button>
      <ExchangePicker />
      <button class={`btn${cmp ? ' active' : ''}`} onClick={() => (cmp ? (comparePair.value = null) : (modal.value = 'compare'))} title={cmp ? t('clearCompare') : t('compareHint')} aria-pressed={!!cmp}>
        ⇆ {cmp ? `${cmp.base}/${cmp.quote} ✕` : t('compare')}
      </button>
      <span class="spacer" />
      <div class="seg" role="group" aria-label={t('layout')}>
        {LAYOUTS.map(([n, icon]) => (
          <button key={n} class={`btn seg-btn${layout.value === n ? ' active' : ''}`} aria-pressed={layout.value === n} aria-label={`${t('layout')} ${n}`} title={`${t('layout')} ${n}`} onClick={() => (layout.value = n)}>
            {icon}
          </button>
        ))}
      </div>
      <button class="btn" onClick={() => (modal.value = 'alerts')} aria-label={t('alerts')} title={t('alerts')}>🔔{activeAlertCount() ? ` ${activeAlertCount()}` : ''}</button>
      <button class="btn icon" aria-label={t('watchlist')} title={t('watchlist')} aria-pressed={sidebarOpen.value} onClick={() => (sidebarOpen.value = !sidebarOpen.value)}>☰</button>
      <button class="btn icon" aria-label={t('theme')} title={t('theme')} onClick={() => (theme.value = theme.value === 'dark' ? 'light' : 'dark')}>
        {theme.value === 'dark' ? '☾' : '☀'}
      </button>
      <button class="btn" aria-label={t('language')} onClick={() => setLang(lang.value === 'es' ? 'en' : 'es')}>
        {lang.value === 'es' ? 'EN' : 'ES'}
      </button>
      <MoreMenu />
      {m === 'indicators' && <IndicatorPanel onClose={close} />}
      {m === 'search' && <SymbolSearch onClose={close} onPick={(p) => selectPair(p)} />}
      {m === 'compare' && <SymbolSearch title={t('compare')} onClose={close} onPick={(p) => (comparePair.value = p)} />}
      {m === 'alerts' && <AlertsPanel onClose={close} />}
      {m === 'backup' && <BackupPanel onClose={close} />}
      {m === 'help' && <HelpPanel onClose={close} />}
    </header>
  );
}
