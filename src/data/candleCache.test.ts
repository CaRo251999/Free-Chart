import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedCandles, cachedValue, clearMemoryCache } from './candleCache';
import type { Candle, ExchangeAdapter } from '../exchanges/types';

const mk = (time: number): Candle => ({ time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 });

function fakeAdapter(id: string, data: Candle[]) {
  const velas = vi.fn(async (_s: string, _i: string, o?: { limit?: number; before?: number }) => {
    let list = data;
    if (o?.before !== undefined) list = list.filter((c) => c.time < (o.before as number));
    return list.slice(-(o?.limit ?? 500));
  });
  return { adapter: { id, velasHistoricas: velas } as unknown as ExchangeAdapter, velas };
}

beforeEach(() => clearMemoryCache());

describe('cachedCandles', () => {
  it('fetches once, then only requests the missing right edge', async () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - (now % 3600) - 10 * 3600;
    const data = Array.from({ length: 11 }, (_, i) => mk(start + i * 3600));
    const { adapter, velas } = fakeAdapter('coinbase', data);

    const first = await cachedCandles(adapter, 'T-1', '1h', { limit: 5 });
    expect(first).toHaveLength(5);
    const second = await cachedCandles(adapter, 'T-1', '1h', { limit: 5 });
    expect(second).toHaveLength(5);
    // second call asked for a small tail, not the whole history again
    expect((velas.mock.calls[1]?.[2] as { limit: number }).limit).toBeLessThanOrEqual(5);
  });

  it('pages older candles with `before` and keeps them cached', async () => {
    const data = Array.from({ length: 30 }, (_, i) => mk(1000 + i * 3600));
    const { adapter, velas } = fakeAdapter('kraken', data);
    const older = await cachedCandles(adapter, 'T-2', '1h', { limit: 10, before: 1000 + 20 * 3600 });
    expect(older).toHaveLength(10);
    expect(older.every((c) => c.time < 1000 + 20 * 3600)).toBe(true);
    await cachedCandles(adapter, 'T-2', '1h', { limit: 10, before: 1000 + 20 * 3600 });
    expect(velas).toHaveBeenCalledTimes(1);
  });
});

describe('cachedValue', () => {
  it('serves from IndexedDB inside the TTL', async () => {
    const load = vi.fn(async () => [1, 2, 3]);
    expect(await cachedValue('k-test', 60_000, load)).toEqual([1, 2, 3]);
    expect(await cachedValue('k-test', 60_000, load)).toEqual([1, 2, 3]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
