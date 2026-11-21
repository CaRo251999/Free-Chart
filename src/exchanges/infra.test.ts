import { describe, expect, it, vi } from 'vitest';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket, backoffDelay } from './ws';
import { CandleBuilder, aggregateCandles, normalizeCandles } from './candles';
import { bucketStart } from './intervals';
import { heikinAshi } from '../chart/heikinAshi';
import { equivalentQuotes, normalizeBase } from './symbols';
import type { Candle } from './types';

const c = (time: number, o: number, h: number, l: number, cl: number, v = 1): Candle => ({ time, open: o, high: h, low: l, close: cl, volume: v });

describe('backoffDelay', () => {
  it('grows exponentially, capped, with jitter between 50% and 100%', () => {
    expect(backoffDelay(0, 1000, 30000, () => 1)).toBe(1000);
    expect(backoffDelay(3, 1000, 30000, () => 1)).toBe(8000);
    expect(backoffDelay(10, 1000, 30000, () => 1)).toBe(30000);
    expect(backoffDelay(3, 1000, 30000, () => 0)).toBe(4000);
  });
});

describe('RateLimiter', () => {
  it('delays calls beyond the burst capacity', async () => {
    vi.useFakeTimers();
    const lim = new RateLimiter(2, 1);
    const done: number[] = [];
    for (let i = 0; i < 3; i++) void lim.take().then(() => done.push(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(1100);
    expect(done).toEqual([0, 1, 2]);
    vi.useRealTimers();
  });
});

describe('ReconnectingSocket', () => {
  class FakeWS {
    static instances: FakeWS[] = [];
    readyState = 0;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    sent: string[] = [];
    constructor(public url: string) {
      FakeWS.instances.push(this);
    }
    send(d: string) { this.sent.push(d); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
  }

  it('reconnects with backoff, resubscribes, and stops after close()', async () => {
    vi.useFakeTimers();
    FakeWS.instances = [];
    const states: string[] = [];
    const sock = new ReconnectingSocket({
      url: 'wss://x',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      rand: () => 1,
      onState: (s) => states.push(s),
      onOpen: (send) => send('sub'),
      onMessage: () => {},
    });
    FakeWS.instances[0]?.open();
    expect(FakeWS.instances[0]?.sent).toEqual(['sub']);
    FakeWS.instances[0]?.close(); // connection drops
    expect(states).toContain('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWS.instances).toHaveLength(2);
    FakeWS.instances[1]?.open();
    expect(FakeWS.instances[1]?.sent).toEqual(['sub']);
    sock.close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeWS.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});

describe('candle utilities', () => {
  it('bucketStart aligns weeks to Monday UTC', () => {
    const monday = Date.UTC(2024, 0, 1) / 1000; // 2024-01-01 was a Monday
    expect(bucketStart(monday + 3 * 86400 + 500, '1w')).toBe(monday);
    expect(bucketStart(monday + 6 * 86400, '1w')).toBe(monday);
    expect(bucketStart(monday + 7 * 86400, '1w')).toBe(monday + 7 * 86400);
  });
  it('aggregates OHLCV', () => {
    const out = aggregateCandles([c(0, 1, 5, 1, 2, 1), c(3600, 2, 9, 2, 8, 2), c(14400, 8, 8, 3, 4, 3)], '4h');
    expect(out).toEqual([c(0, 1, 9, 1, 8, 3), c(14400, 8, 8, 3, 4, 3)]);
  });
  it('normalizes: sorts and de-duplicates, later wins', () => {
    const out = normalizeCandles([c(2, 1, 1, 1, 1), c(1, 1, 1, 1, 1), c(2, 1, 1, 1, 9)]);
    expect(out.map((x) => [x.time, x.close])).toEqual([[1, 1], [2, 9]]);
  });
  it('CandleBuilder opens a new candle on a new bucket', () => {
    const b = new CandleBuilder('1m', c(0, 10, 10, 10, 10, 1));
    expect(b.tick(12, 1, 30)).toMatchObject({ time: 0, high: 12, close: 12, volume: 2 });
    expect(b.tick(9, 1, 61)).toMatchObject({ time: 60, open: 9, high: 9, volume: 1 });
  });
});

describe('heikinAshi', () => {
  it('matches hand-computed values', () => {
    const ha = heikinAshi([c(1, 10, 20, 5, 15), c(2, 15, 25, 10, 20)]);
    expect(ha[0]).toMatchObject({ close: 12.5, open: 12.5 });
    expect(ha[1]?.close).toBeCloseTo(17.5);
    expect(ha[1]?.open).toBeCloseTo(12.5);
    expect(ha[1]?.high).toBe(25);
    expect(ha[1]?.low).toBe(10);
  });
});

describe('symbols', () => {
  it('normalizes Kraken aliases', () => {
    expect(normalizeBase('XBT')).toBe('BTC');
    expect(normalizeBase('xdg')).toBe('DOGE');
  });
  it('USD-like quotes are interchangeable', () => {
    expect(equivalentQuotes('USD')).toEqual(['USD', 'USDT', 'USDC']);
    expect(equivalentQuotes('EUR')).toEqual(['EUR']);
  });
});
