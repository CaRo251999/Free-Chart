import { useEffect, useRef, useState } from 'preact/hooks';
import { ChartController, type ChartStatus } from '../chart/controller';
import { IndicatorManager } from '../chart/indicatorManager';
import { indicators } from '../indicators/state';
import { chartType, interval, theme, preferenceFor, magnet, comparePair, extraPairs } from '../state';
import { registerForCrosshairSync } from '../chart/crosshairSync';
import { primaryChart } from './uiState';
import { SymbolSearch } from './SymbolSearch';
import { DrawingManager } from '../drawing/manager';
import { drawingMgr, drawingUi } from '../drawing/state';
import { DrawingToolbar } from './DrawingToolbar';
import { lang, t } from '../i18n';
import type { Pair } from '../exchanges/symbols';
import { pairKey } from '../exchanges/symbols';
import type { Preference } from '../exchanges/registry';
import { ADAPTERS } from '../exchanges/registry';

interface Props {
  pair: Pair;
  /** Overrides the global interval/exchange (used by secondary panes). */
  pref?: Preference;
  onController?: (c: ChartController | null) => void;
  onStatus?: (s: ChartStatus) => void;
  compact?: boolean;
  /** The primary chart owns the drawing toolbar and accepts drawing gestures. */
  primary?: boolean;
  /** Index in extraPairs for secondary charts of multi-chart layouts (lets the user pick their pair). */
  slot?: number;
}

export function ChartView({ pair, pref, onController, onStatus, compact, primary, slot }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const ctl = useRef<ChartController | null>(null);
  const ind = useRef<IndicatorManager | null>(null);
  const draw = useRef<DrawingManager | null>(null);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<ChartStatus>({ loading: true, fellBack: false, stream: 'connecting' });

  useEffect(() => {
    const c = new ChartController(el.current as HTMLElement, {
      theme: theme.peek(),
      locale: lang.peek(),
      onStatus: (s) => {
        setStatus(s);
        onStatus?.(s);
      },
    });
    c.setType(chartType.peek());
    ctl.current = c;
    const offSync = registerForCrosshairSync(c);
    if (primary) primaryChart.value = c;
    ind.current = new IndicatorManager(c);
    ind.current.sync(indicators.peek());
    const dm = new DrawingManager(c, el.current as HTMLElement, !primary);
    draw.current = dm;
    dm.setMagnet(magnet.peek());
    if (primary) {
      dm.onChange = (st) => (drawingUi.value = st);
      drawingMgr.value = dm;
    }
    dm.setSymbol(pairKey(pair));
    onController?.(c);
    return () => {
      onController?.(null);
      offSync();
      if (primary) {
        primaryChart.value = null;
        drawingMgr.value = null;
        drawingUi.value = { selected: null, canUndo: false, canRedo: false, count: 0, tool: 'cursor', draftHint: false };
      }
      draw.current?.destroy();
      draw.current = null;
      ind.current?.destroy();
      ind.current = null;
      c.destroy();
      ctl.current = null;
    };
  }, []);

  const key = pairKey(pair);
  const effectivePref = pref ?? preferenceFor(pair);
  useEffect(() => {
    void ctl.current?.load(pair, interval.value, effectivePref);
  }, [key, interval.value, effectivePref]);

  useEffect(() => {
    if (primary) void ctl.current?.setCompare(comparePair.value);
  }, [comparePair.value]);
  useEffect(() => draw.current?.setSymbol(key), [key]);
  useEffect(() => draw.current?.setMagnet(magnet.value), [magnet.value]);
  useEffect(() => ind.current?.sync(indicators.value), [indicators.value]);
  useEffect(() => ctl.current?.setType(chartType.value), [chartType.value]);
  useEffect(() => ctl.current?.setTheme(theme.value), [theme.value]);
  useEffect(() => ctl.current?.setLocale(lang.value), [lang.value]);

  const last = status.last;
  const live = status.stream === 'open';
  return (
    <div class={`chart-wrap${compact ? ' compact' : ''}`}>
      <div class="chart-head">
        {slot === undefined ? (
          <strong class="chart-pair">{key}</strong>
        ) : (
          <button class="btn chart-pair-btn" onClick={() => setPicking(true)} aria-label={t('pickPair')}>🔍 {key}</button>
        )}
        {last && <span class="chart-price">{last.close}</span>}
        {status.exchange && <span class="chip">{ADAPTERS[status.exchange].name}</span>}
        <span class={`chip ${live ? 'chip-ok' : 'chip-warn'}`}>
          {status.loading ? t('loading') : live ? t('live') : status.stream === 'reconnecting' ? t('reconnecting') : t('offline')}
        </span>
        {status.fellBack && status.exchange && <span class="chip chip-warn">{t('fellBack', { name: ADAPTERS[status.exchange].name })}</span>}
      </div>
      <div class="chart-canvas" ref={el} />
      {primary && <DrawingToolbar />}
      {picking && slot !== undefined && (
        <SymbolSearch onClose={() => setPicking(false)} onPick={(p) => (extraPairs.value = extraPairs.value.map((x, i) => (i === slot ? p : x)))} />
      )}
      {status.error && !status.loading && <div class="chart-msg">{t('noData')}</div>}
    </div>
  );
}
