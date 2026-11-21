import type { Interval } from './types';

export const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

export const INTERVAL_SECONDS: Record<Interval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
};

const DAY = 86400;
/** Start of the candle bucket containing t (weeks start on Monday 00:00 UTC). */
export function bucketStart(t: number, interval: Interval): number {
  const s = INTERVAL_SECONDS[interval];
  if (interval === '1w') return Math.floor((t + 3 * DAY) / s) * s - 3 * DAY;
  return Math.floor(t / s) * s;
}
