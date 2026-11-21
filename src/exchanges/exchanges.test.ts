import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { binance, parseBinanceRow } from './binance';
import { coinbase, parseCoinbaseRow } from './coinbase';
import { kraken, parseKrakenRow } from './kraken';
import { okx, parseOkxRow } from './okx';
import { bybit, parseBybitRow } from './bybit';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const fn = vi.fn((url: string | URL | Request) => Promise.resolve(handler(String(url))));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('row parsers', () => {
  it('coinbase [time, low, high, open, close, vol]', () => {
    expect(parseCoinbaseRow([100, 1, 4, 2, 3, 9])).toEqual({ time: 100, low: 1, high: 4, open: 2, close: 3, volume: 9 });
  });
  it('kraken [time, o, h, l, c, vwap, vol]', () => {
    expect(parseKrakenRow([100, '2', '4', '1', '3', '2.5', '9', 5])).toEqual({ time: 100, open: 2, high: 4, low: 1, close: 3, volume: 9 });
  });
  it('binance converts ms to seconds', () => {
    expect(parseBinanceRow([100000, '2', '4', '1', '3', '9']).time).toBe(100);
  });
  it('okx converts ms to seconds', () => {
    expect(parseOkxRow(['100000', '2', '4', '1', '3', '9']).time).toBe(100);
  });
  it('bybit converts ms to seconds', () => {
    expect(parseBybitRow(['100000', '2', '4', '1', '3', '9']).close).toBe(3);
  });
});

describe('native symbols', () => {
  it('formats per exchange', () => {
    expect(coinbase.toNative('BTC', 'USD')).toBe('BTC-USD');
    expect(kraken.toNative('BTC', 'USD')).toBe('BTC/USD');
    expect(binance.toNative('BTC', 'USDT')).toBe('BTCUSDT');
    expect(okx.toNative('BTC', 'USDT')).toBe('BTC-USDT');
    expect(bybit.toNative('BTC', 'USDT')).toBe('BTCUSDT');
  });
  it('flags US-restricted exchanges', () => {
    expect([coinbase, kraken].every((a) => !a.usRestricted)).toBe(true);
    expect([binance, okx, bybit].every((a) => a.usRestricted)).toBe(true);
  });
});

describe('binance adapter', () => {
  it('fetches klines ascending', async () => {
    mockFetch(() => json([[2000000, '1', '2', '0.5', '1.5', '10'], [1000000, '1', '2', '0.5', '1.2', '5']]));
    const out = await binance.velasHistoricas('BTCUSDT', '1h', { limit: 2 });
    expect(out.map((c) => c.time)).toEqual([1000, 2000]);
  });
  it('maps ticker24h', async () => {
    mockFetch(() => json({ lastPrice: '100', priceChangePercent: '2.5', volume: '7', highPrice: '110', lowPrice: '90' }));
    expect(await binance.ticker24h('BTCUSDT')).toEqual({ last: 100, changePct: 2.5, volume24h: 7, high: 110, low: 90 });
  });
  it('lists TRADING symbols only', async () => {
    mockFetch(() => json({ symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' }, { symbol: 'XUSDT', baseAsset: 'X', quoteAsset: 'USDT', status: 'BREAK' }] }));
    expect((await binance.buscarSimbolos()).map((s) => s.id)).toEqual(['BTCUSDT']);
  });
  it('maps 451 to a geo error', async () => {
    mockFetch(() => json({}, 451));
    await expect(binance.ticker24h('BTCUSDT')).rejects.toMatchObject({ kind: 'geo' });
  });
});

describe('coinbase adapter', () => {
  it('aggregates 1h candles into 4h buckets', async () => {
    const base = 1_700_000_000 - (1_700_000_000 % 14400); // 4h aligned
    const rows = [0, 1, 2, 3].map((i) => [base + i * 3600, 1, 10 + i, 5, 6 + i, 1]).reverse();
    mockFetch((url) => (url.includes('start=') && rows.length ? json(rows) : json([])));
    const out = await coinbase.velasHistoricas('BTC-USD', '4h', { limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ time: base, high: 13, low: 1, volume: 4 });
  });
  it('maps ticker24h with change from open', async () => {
    mockFetch(() => json({ open: '100', high: '120', low: '90', last: '110', volume: '5' }));
    const t = await coinbase.ticker24h('BTC-USD');
    expect(t.changePct).toBeCloseTo(10);
  });
  it('lists only online products', async () => {
    mockFetch(() => json([{ id: 'A-USD', base_currency: 'A', quote_currency: 'USD', status: 'online', trading_disabled: false }, { id: 'B-USD', base_currency: 'B', quote_currency: 'USD', status: 'delisted', trading_disabled: true }]));
    expect((await coinbase.buscarSimbolos()).map((s) => s.id)).toEqual(['A-USD']);
  });
});

describe('kraken adapter', () => {
  it('reads the OHLC result regardless of key name and drops "last"', async () => {
    mockFetch(() => json({ error: [], result: { 'BTC/USD': [[100, '1', '2', '0.5', '1.5', '1', '3', 1], [200, '1', '2', '0.5', '1.6', '1', '4', 1]], last: 200 } }));
    const out = await kraken.velasHistoricas('BTC/USD', '1h');
    expect(out.map((c) => c.close)).toEqual([1.5, 1.6]);
  });
  it('maps unknown pair to notfound', async () => {
    mockFetch(() => json({ error: ['EQuery:Unknown asset pair'] }));
    await expect(kraken.velasHistoricas('NOPE/USD', '1h')).rejects.toMatchObject({ kind: 'notfound' });
  });
  it('normalizes XBT in symbol list', async () => {
    mockFetch(() => json({ error: [], result: { XBTUSD: { wsname: 'XBT/USD', status: 'online' } } }));
    expect(await kraken.buscarSimbolos()).toEqual([{ exchange: 'kraken', id: 'BTC/USD', base: 'BTC', quote: 'USD' }]);
  });
});

describe('okx adapter', () => {
  it('rejects error codes', async () => {
    mockFetch(() => json({ code: '51001', msg: 'Instrument ID does not exist', data: [] }));
    await expect(okx.velasHistoricas('NOPE-USDT', '1h')).rejects.toMatchObject({ kind: 'notfound' });
  });
  it('returns candles ascending', async () => {
    mockFetch(() => json({ code: '0', msg: '', data: [['2000000', '1', '2', '0.5', '1.5', '1'], ['1000000', '1', '2', '0.5', '1.2', '1']] }));
    const out = await okx.velasHistoricas('BTC-USDT', '1h', { limit: 2 });
    expect(out.map((c) => c.time)).toEqual([1000, 2000]);
  });
});
