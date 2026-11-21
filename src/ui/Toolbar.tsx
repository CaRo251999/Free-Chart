import { useState } from 'preact/hooks';
import { chartType, interval, pair, preferenceFor, selectPair, setPreference, sidebarOpen, theme, type ChartType } from '../state';
import { lang, setLang, t } from '../i18n';
import { INTERVALS } from '../exchanges/intervals';
import { ADAPTERS, ALL_IDS, type Preference } from '../exchanges/registry';
import { pairKey } from '../exchanges/symbols';
import { SymbolSearch } from './SymbolSearch';
import { IndicatorPanel } from './IndicatorPanel';
import { indicators } from '../indicators/state';
import { Modal } from './Modal';
import { load, save } from '../data/storage';
import type { ExchangeId } from '../exchanges/types';

const LABEL: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1D', '1w': '1S' };
const LABEL_EN: Record<string, string> = { ...LABEL, '1w': '1W' };
const TYPES: ChartType[] = ['candles', 'line', 'area', 'heikin'];

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

export function Toolbar() {
  const [searching, setSearching] = useState(false);
  const [indOpen, setIndOpen] = useState(false);
  const labels = lang.value === 'en' ? LABEL_EN : LABEL;
  return (
    <header class="toolbar">
      <a class="brand" href="#/" aria-label={t('appName')}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="24" height="24" />
        <span>{t('appName')}</span>
      </a>
      <button class="btn pair-btn" onClick={() => setSearching(true)} aria-label={t('search')}>
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
          <option key={k} value={k}>{t(k === 'heikin' ? 'heikin' : k)}</option>
        ))}
      </select>
      <button class="btn" onClick={() => setIndOpen(true)} aria-label={t('indicators')}>ƒx {t('indicators')}{indicators.value.length ? ` (${indicators.value.length})` : ''}</button>
      <ExchangePicker />
      <span class="spacer" />
      <button class="btn icon" aria-label={t('watchlist')} title={t('watchlist')} aria-pressed={sidebarOpen.value} onClick={() => (sidebarOpen.value = !sidebarOpen.value)}>☰</button>
      <button class="btn icon" aria-label={t('theme')} title={t('theme')} onClick={() => (theme.value = theme.value === 'dark' ? 'light' : 'dark')}>
        {theme.value === 'dark' ? '☾' : '☀'}
      </button>
      <button class="btn" aria-label={t('language')} onClick={() => setLang(lang.value === 'es' ? 'en' : 'es')}>
        {lang.value === 'es' ? 'EN' : 'ES'}
      </button>
      {indOpen && <IndicatorPanel onClose={() => setIndOpen(false)} />}
      {searching && <SymbolSearch onClose={() => setSearching(false)} onPick={(p) => selectPair(p)} />}
    </header>
  );
}
