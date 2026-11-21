import type { Candle, Interval } from './types';
import { bucketStart } from './intervals';

/** Groups finer candles into `target` buckets (used when an exchange lacks 4h / 1w). */
export function aggregateCandles(src: Candle[], target: Interval): Candle[] {
  const out: Candle[] = [];
  for (const c of src) {
    const t = bucketStart(c.time, target);
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume += c.volume;
    } else {
      out.push({ ...c, time: t });
    }
  }
  return out;
}

/** Sorts ascending and removes duplicate times (later entry wins). */
export function normalizeCandles(list: Candle[]): Candle[] {
  const m = new Map<number, Candle>();
  for (const c of list) m.set(c.time, c);
  return [...m.values()].sort((a, b) => a.time - b.time);
}

/** Builds live candles from trade/ticker ticks, seeded with the last known candle. */
export class CandleBuilder {
  private cur: Candle | null;
  constructor(
    private interval: Interval,
    seed: Candle | null = null,
  ) {
    this.cur = seed ? { ...seed } : null;
  }

  tick(price: number, size: number, timeSec: number): Candle {
    const t = bucketStart(timeSec, this.interval);
    if (!this.cur || t > this.cur.time) {
      this.cur = { time: t, open: price, high: price, low: price, close: price, volume: size };
    } else {
      this.cur.high = Math.max(this.cur.high, price);
      this.cur.low = Math.min(this.cur.low, price);
      this.cur.close = price;
      this.cur.volume += size;
    }
    return { ...this.cur };
  }
}
