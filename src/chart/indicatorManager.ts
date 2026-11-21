import { HistogramSeries, LineSeries, type ISeriesApi, type SeriesType, type UTCTimestamp } from 'lightweight-charts';
import type { ChartController } from './controller';
import type { Candle } from '../exchanges/types';
import { INTERVAL_SECONDS } from '../exchanges/intervals';
import { BY_ID, type IndicatorInstance, type LineSpec } from '../indicators/registry';
import type { Series } from '../indicators/math';

const NEG = '#ef4444';
const sig = (i: IndicatorInstance) => JSON.stringify([i.id, i.params, i.colors, i.width]);

interface Entry {
  inst: IndicatorInstance;
  signature: string;
  series: { spec: LineSpec; api: ISeriesApi<SeriesType> }[];
}

/** Maps a value array to chart points, applying bar offsets (future times are extrapolated). */
export function toPoints(candles: Candle[], values: Series, intervalSec: number, offset = 0): { time: UTCTimestamp; value: number }[] {
  const n = candles.length;
  const out: { time: UTCTimestamp; value: number }[] = [];
  const last = (candles[n - 1] as Candle | undefined)?.time ?? 0;
  for (let j = 0; j < values.length; j++) {
    const v = values[j];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const k = j + offset;
    if (k < 0) continue;
    const time = k < n ? (candles[k] as Candle).time : last + (k - (n - 1)) * intervalSec;
    out.push({ time: time as UTCTimestamp, value: v });
  }
  return out;
}

/** Draws indicator instances on a ChartController: overlays on the price pane, others in their own panes. */
export class IndicatorManager {
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private off: () => void;

  constructor(private ctl: ChartController) {
    this.off = ctl.onData((full) => (full ? this.recompute() : this.schedule()));
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.recompute();
    }, 250);
  }

  sync(instances: IndicatorInstance[]) {
    const wanted = new Set(instances.map((i) => i.uid));
    for (const [uid, e] of this.entries) {
      const next = instances.find((i) => i.uid === uid);
      if (!wanted.has(uid) || (next && sig(next) !== e.signature)) this.destroyEntry(uid);
    }
    for (const inst of instances) if (!this.entries.has(inst.uid)) this.create(inst);
    this.layout();
    this.recompute();
  }

  private create(inst: IndicatorInstance) {
    const def = BY_ID[inst.id];
    if (!def) return;
    const chart = this.ctl.chart;
    const pane = def.placement === 'overlay' ? 0 : chart.panes().length;
    const series = def.lines.map((spec, i) => {
      const color = inst.colors[i] ?? spec.color;
      const common = { lastValueVisible: false, priceLineVisible: false };
      let api: ISeriesApi<SeriesType>;
      if (spec.kind === 'histogram') {
        api = chart.addSeries(HistogramSeries, { ...common, color, priceFormat: { type: def.id === 'volume' ? 'volume' : 'price', precision: 4, minMove: 0.0001 } }, pane);
      } else {
        api = chart.addSeries(
          LineSeries,
          {
            ...common,
            color,
            lineWidth: Math.min(4, Math.max(1, inst.width)) as 1 | 2 | 3 | 4,
            crosshairMarkerVisible: false,
            lineVisible: spec.kind !== 'dots',
            pointMarkersVisible: spec.kind === 'dots',
            pointMarkersRadius: 2,
          },
          pane,
        );
      }
      if (def.range) {
        const [min, max] = def.range;
        api.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: min, maxValue: max } }) });
      }
      return { spec, api };
    });
    const first = series[0]?.api;
    if (first && def.levels) for (const price of def.levels) first.createPriceLine({ price, color: '#64748b', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
    this.entries.set(inst.uid, { inst, signature: sig(inst), series });
  }

  private destroyEntry(uid: string) {
    const e = this.entries.get(uid);
    if (!e) return;
    for (const s of e.series) this.ctl.chart.removeSeries(s.api);
    this.entries.delete(uid);
  }

  /** Price pane gets most of the height; each indicator pane a small share. */
  private layout() {
    const panes = this.ctl.chart.panes();
    if (panes.length < 2) return;
    panes[0]?.setStretchFactor(4);
    for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
  }

  recompute() {
    const candles = this.ctl.candles;
    const step = INTERVAL_SECONDS[this.ctl.interval];
    for (const e of this.entries.values()) {
      const def = BY_ID[e.inst.id];
      if (!def) continue;
      const result = def.compute(candles, e.inst.params);
      e.series.forEach(({ spec, api }, i) => {
        const color = e.inst.colors[i] ?? spec.color;
        const offset = spec.offsetParam ? spec.offsetParam.sign * (e.inst.params[spec.offsetParam.key] ?? 0) : 0;
        const pts = toPoints(candles, (result[spec.key] ?? []) as Series, step, offset);
        if (spec.kind === 'histogram') {
          const byTime = new Map(candles.map((c) => [c.time, c]));
          api.setData(
            pts.map((p) => {
              let c = color;
              if (spec.byCandle) {
                const k = byTime.get(p.time);
                c = k && k.close < k.open ? NEG : color;
              } else if (spec.signed && p.value < 0) c = NEG;
              return { ...p, color: c };
            }) as never,
          );
        } else {
          api.setData(pts as never);
        }
      });
    }
  }

  destroy() {
    this.off();
    if (this.timer) clearTimeout(this.timer);
    for (const uid of [...this.entries.keys()]) this.destroyEntry(uid);
  }
}
