import type { Time } from 'lightweight-charts';
import type { ChartController } from './controller';
import type { Candle } from '../exchanges/types';

const charts = new Set<ChartController>();
let syncing = false;

/** Finds the candle with exactly this time (candles are sorted ascending). */
export function candleAt(candles: Candle[], time: number): Candle | undefined {
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = candles[mid] as Candle;
    if (c.time === time) return c;
    if (c.time < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/** Links a chart's crosshair to every other registered chart (same time, vertical line follows). */
export function registerForCrosshairSync(ctl: ChartController): () => void {
  charts.add(ctl);
  const handler = (param: { time?: Time }) => {
    if (syncing) return;
    syncing = true;
    try {
      for (const other of charts) {
        if (other === ctl || !other.main) continue;
        const c = param.time === undefined ? undefined : candleAt(other.candles, param.time as number);
        if (c) other.chart.setCrosshairPosition(c.close, param.time as Time, other.main);
        else other.chart.clearCrosshairPosition();
      }
    } finally {
      syncing = false;
    }
  };
  ctl.chart.subscribeCrosshairMove(handler);
  return () => {
    charts.delete(ctl);
    ctl.chart.unsubscribeCrosshairMove(handler);
  };
}
