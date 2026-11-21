import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, ExchangeId, Interval, StreamState } from '../exchanges/types';
import type { Pair } from '../exchanges/symbols';
import type { Preference } from '../exchanges/registry';
import { fetchHistory, subscribeLive } from '../exchanges/router';
import { ADAPTERS } from '../exchanges/registry';
import { cachedCandles } from '../data/candleCache';
import { heikinAshi } from './heikinAshi';
import { COLORS } from './theme';
import type { ChartType, Theme } from '../state';

export interface ChartStatus {
  loading: boolean;
  exchange?: ExchangeId;
  symbol?: string;
  servedPair?: Pair;
  fellBack: boolean;
  error?: string;
  stream: StreamState;
  last?: Candle;
}

export interface ControllerOptions {
  theme: Theme;
  locale: string;
  onStatus?: (s: ChartStatus) => void;
}

const t = (x: number) => x as UTCTimestamp;

export function priceFormatFor(price: number) {
  const p = Math.abs(price);
  const precision = p >= 1000 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 6 : 8;
  return { type: 'price' as const, precision, minMove: 10 ** -precision };
}

export class ChartController {
  readonly chart: IChartApi;
  main: ISeriesApi<SeriesType> | null = null;
  readonly volume: ISeriesApi<'Histogram'>;
  candles: Candle[] = [];
  pair: Pair | null = null;
  interval: Interval = '1h';
  chartType: ChartType = 'candles';
  status: ChartStatus = { loading: false, fellBack: false, stream: 'closed' };

  private theme: Theme;
  private locale: string;
  private unsubscribe: (() => void) | null = null;
  private token = 0;
  private loadingMore = false;
  private exhausted = false;
  private dataListeners = new Set<(full: boolean) => void>();
  private comparePair: Pair | null = null;
  private compareSeries: ISeriesApi<'Line'> | null = null;
  private compareUnsub: (() => void) | null = null;
  private compareToken = 0;
  private mainListeners = new Set<(s: ISeriesApi<SeriesType>) => void>();

  constructor(
    el: HTMLElement,
    private opts: ControllerOptions,
  ) {
    this.theme = opts.theme;
    this.locale = opts.locale;
    const c = COLORS[this.theme];
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
        attributionLogo: true, // required by the lightweight-charts license; keep visible
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, rightOffset: 6, tickMarkFormatter: (time: Time, type: TickMarkType) => this.tickFormat(time, type) },
      localization: { timeFormatter: (time: Time) => this.fullFormat(time) },
    });
    this.volume = this.chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    this.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    this.createMain();
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (r && r.from < 15) void this.loadMore();
    });
  }

  // ---- formatting (axis shows the user's local time) ----
  private tickFormat(time: Time, type: TickMarkType): string | null {
    const d = new Date((time as number) * 1000);
    switch (type) {
      case TickMarkType.Year: return String(d.getFullYear());
      case TickMarkType.Month: return d.toLocaleDateString(this.locale, { month: 'short' });
      case TickMarkType.DayOfMonth: return d.toLocaleDateString(this.locale, { day: 'numeric', month: 'short' });
      default: return d.toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }
  private fullFormat(time: Time): string {
    return new Date((time as number) * 1000).toLocaleString(this.locale, { dateStyle: 'medium', timeStyle: 'short' });
  }
  setLocale(locale: string) {
    this.locale = locale;
    this.chart.applyOptions({});
  }

  // ---- series ----
  private createMain() {
    const c = COLORS[this.theme];
    if (this.main) this.chart.removeSeries(this.main);
    switch (this.chartType) {
      case 'line':
        this.main = this.chart.addSeries(LineSeries, { color: c.line, lineWidth: 2 }, 0);
        break;
      case 'area':
        this.main = this.chart.addSeries(AreaSeries, { lineColor: c.line, topColor: `${c.line}66`, bottomColor: `${c.line}05`, lineWidth: 2 }, 0);
        break;
      default:
        this.main = this.chart.addSeries(CandlestickSeries, {
          upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down,
        }, 0);
    }
    this.notifyMain();
  }

  private notifyMain() {
    if (this.main) for (const cb of this.mainListeners) cb(this.main);
  }

  private mainData(list: Candle[]) {
    if (this.chartType === 'line' || this.chartType === 'area') return list.map((k) => ({ time: t(k.time), value: k.close }));
    const src = this.chartType === 'heikin' ? heikinAshi(list) : list;
    return src.map((k) => ({ time: t(k.time), open: k.open, high: k.high, low: k.low, close: k.close }));
  }

  private volData(k: Candle) {
    const c = COLORS[this.theme];
    return { time: t(k.time), value: k.volume, color: k.close >= k.open ? c.upVol : c.downVol };
  }

  private renderAll() {
    this.main?.setData(this.mainData(this.candles) as never);
    this.volume.setData(this.candles.map((k) => this.volData(k)));
    const last = this.candles[this.candles.length - 1];
    if (last) this.main?.applyOptions({ priceFormat: priceFormatFor(last.close) } as never);
    this.emitData(true);
  }

  private renderLast() {
    const last = this.candles[this.candles.length - 1];
    if (!last) return;
    // Heikin Ashi depends on the previous candle: recompute the tail only.
    const tail = this.chartType === 'heikin' ? this.mainData(this.candles).slice(-1)[0] : this.mainData([last])[0];
    if (tail) this.main?.update(tail as never);
    this.volume.update(this.volData(last));
    this.emitData(false);
  }

  /** Fires whenever the main price series is (re)created, so primitives can re-attach. */
  onMainChange(cb: (s: ISeriesApi<SeriesType>) => void): () => void {
    this.mainListeners.add(cb);
    if (this.main) cb(this.main);
    return () => this.mainListeners.delete(cb);
  }

  onData(cb: (full: boolean) => void): () => void {
    this.dataListeners.add(cb);
    return () => this.dataListeners.delete(cb);
  }
  private emitData(full: boolean) {
    for (const cb of this.dataListeners) cb(full);
  }

  private setStatus(patch: Partial<ChartStatus>) {
    this.status = { ...this.status, ...patch };
    this.opts.onStatus?.(this.status);
  }

  // ---- public API ----
  setType(type: ChartType) {
    if (type === this.chartType && this.main) return;
    this.chartType = type;
    this.createMain();
    this.renderAll();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    const c = COLORS[theme];
    this.chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    this.createMain();
    this.renderAll();
  }

  async load(pair: Pair, interval: Interval, pref: Preference) {
    const token = ++this.token;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pair = pair;
    this.interval = interval;
    this.exhausted = false;
    this.candles = [];
    this.setStatus({ loading: true, error: undefined, fellBack: false, stream: 'connecting', last: undefined });
    try {
      const res = await fetchHistory(pair, interval, pref, { limit: 500 });
      if (token !== this.token) return;
      this.candles = res.data;
      this.renderAll();
      this.chart.timeScale().fitContent();
      this.chart.timeScale().scrollToPosition(6, false);
      this.setStatus({ loading: false, exchange: res.exchange, symbol: res.symbol, servedPair: res.pair, fellBack: res.fellBack, last: res.data[res.data.length - 1] });
      if (this.comparePair) void this.reloadCompare();
      this.unsubscribe = subscribeLive(
        res.exchange,
        res.symbol,
        interval,
        (k) => this.applyLive(k, token),
        (s) => token === this.token && this.setStatus({ stream: s }),
      );
    } catch (e) {
      if (token !== this.token) return;
      this.setStatus({ loading: false, error: e instanceof Error ? e.message : 'error', stream: 'closed' });
    }
  }

  private applyLive(k: Candle, token: number) {
    if (token !== this.token || !Number.isFinite(k.close)) return;
    const last = this.candles[this.candles.length - 1];
    if (last && k.time < last.time) return;
    if (last && k.time === last.time) this.candles[this.candles.length - 1] = k;
    else this.candles.push(k);
    this.renderLast();
    this.setStatus({ last: k });
  }

  async loadMore() {
    const first = this.candles[0];
    if (this.loadingMore || this.exhausted || !first || !this.pair || !this.status.exchange) return;
    this.loadingMore = true;
    const token = this.token;
    try {
      const adapter = ADAPTERS[this.status.exchange];
      const older = await cachedCandles(adapter, this.status.symbol as string, this.interval, { limit: 500, before: first.time });
      if (token !== this.token) return;
      if (!older.length) {
        this.exhausted = true;
      } else {
        const range = this.chart.timeScale().getVisibleLogicalRange();
        this.candles = [...older, ...this.candles];
        this.renderAll();
        if (range) this.chart.timeScale().setVisibleLogicalRange({ from: range.from + older.length, to: range.to + older.length });
      }
    } catch {
      this.exhausted = true;
    } finally {
      this.loadingMore = false;
    }
  }

  /** Overlays another pair as a percentage line (the price axis switches to % mode). */
  async setCompare(pair: Pair | null) {
    this.comparePair = pair;
    await this.reloadCompare();
  }

  private clearCompare() {
    this.compareUnsub?.();
    this.compareUnsub = null;
    if (this.compareSeries) this.chart.removeSeries(this.compareSeries);
    this.compareSeries = null;
  }

  private async reloadCompare() {
    this.clearCompare();
    const pair = this.comparePair;
    this.chart.priceScale('right').applyOptions({ mode: pair ? PriceScaleMode.Percentage : PriceScaleMode.Normal });
    if (!pair) return;
    const token = ++this.compareToken;
    try {
      const res = await fetchHistory(pair, this.interval, 'auto', { limit: 500 });
      if (token !== this.compareToken) return;
      const series = this.chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: `${pair.base}/${pair.quote}`, priceLineVisible: false }, 0);
      series.setData(res.data.map((k) => ({ time: t(k.time), value: k.close })));
      let last = res.data[res.data.length - 1]?.time ?? 0;
      this.compareSeries = series;
      this.compareUnsub = subscribeLive(res.exchange, res.symbol, this.interval, (k) => {
        if (k.time < last || !Number.isFinite(k.close)) return;
        last = k.time;
        series.update({ time: t(k.time), value: k.close });
      });
    } catch {
      /* comparison unavailable: keep the chart usable */
    }
  }

  destroy() {
    this.token++;
    this.compareToken++;
    this.clearCompare();
    this.unsubscribe?.();
    this.dataListeners.clear();
    this.chart.remove();
  }
}
