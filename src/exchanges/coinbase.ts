import type { Candle, ExchangeAdapter, HistoryOptions, Interval, StreamState, SymbolInfo, Ticker } from './types';
import { ExchangeError } from './types';
import { getJson } from './http';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket } from './ws';

import { CandleBuilder, aggregateCandles, normalizeCandles } from './candles';

const REST = 'https://api.exchange.coinbase.com';
const WS = 'wss://ws-feed.exchange.coinbase.com';
const limiter = new RateLimiter(10, 8); // public limit: 10 req/s

/** Native granularities; 4h and 1w are aggregated from 1h / 1d. */
const GRAN: Record<Interval, { gran: number; ratio: number }> = {
  '1m': { gran: 60, ratio: 1 },
  '5m': { gran: 300, ratio: 1 },
  '15m': { gran: 900, ratio: 1 },
  '1h': { gran: 3600, ratio: 1 },
  '4h': { gran: 3600, ratio: 4 },
  '1d': { gran: 86400, ratio: 1 },
  '1w': { gran: 86400, ratio: 7 },
};

/** Row: [time, low, high, open, close, volume] */
export function parseCoinbaseRow(r: number[]): Candle {
  return { time: Number(r[0]), low: Number(r[1]), high: Number(r[2]), open: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) };
}

interface Product {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
  trading_disabled: boolean;
}

async function fetchCandles(symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const { gran, ratio } = GRAN[interval];
  const want = opts.limit ?? 500;
  const needed = Math.min(want * ratio + ratio, 3000);
  let end = opts.before ?? Math.floor(Date.now() / 1000) + gran;
  const rows: Candle[] = [];
  while (rows.length < needed) {
    const start = end - 300 * gran;
    const url = `${REST}/products/${symbol}/candles?granularity=${gran}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
    const page = await getJson<number[][]>(limiter, url, opts.signal);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page.map(parseCoinbaseRow).filter((c) => c.time < end));
    end = start;
  }
  let out = normalizeCandles(rows);
  if (ratio > 1) out = aggregateCandles(out, interval);
  return out.slice(-want);
}

export const coinbase: ExchangeAdapter = {
  id: 'coinbase',
  name: 'Coinbase',
  usRestricted: false,
  toNative: (base, quote) => `${base}-${quote}`,

  async buscarSimbolos(): Promise<SymbolInfo[]> {
    const list = await getJson<Product[]>(limiter, `${REST}/products`);
    return list
      .filter((p) => p.status === 'online' && !p.trading_disabled)
      .map((p) => ({ exchange: 'coinbase' as const, id: p.id, base: p.base_currency, quote: p.quote_currency }));
  },

  velasHistoricas: fetchCandles,

  streamTiempoReal(symbol, interval, onCandle, onState) {
    let builder: CandleBuilder | null = null;
    let closed = false;
    fetchCandles(symbol, interval, { limit: 1 })
      .then((c) => { if (!closed) builder = new CandleBuilder(interval, c[c.length - 1] ?? null); })
      .catch(() => { if (!closed) builder = new CandleBuilder(interval, null); });
    const sock = new ReconnectingSocket({
      url: WS,
      onState: onState as (s: StreamState) => void,
      onOpen: (send) => send(JSON.stringify({ type: 'subscribe', product_ids: [symbol], channels: ['ticker'] })),
      onMessage: (raw) => {
        const m = JSON.parse(raw) as { type?: string; price?: string; last_size?: string; time?: string };
        if (m.type !== 'ticker' || !m.price || !builder) return;
        const t = m.time ? Date.parse(m.time) / 1000 : Date.now() / 1000;
        onCandle(builder.tick(Number(m.price), Number(m.last_size ?? 0), t));
      },
    });
    return () => { closed = true; sock.close(); };
  },

  async ticker24h(symbol): Promise<Ticker> {
    const s = await getJson<{ open: string; high: string; low: string; last: string; volume: string }>(limiter, `${REST}/products/${symbol}/stats`);
    const last = Number(s.last);
    const open = Number(s.open);
    if (!Number.isFinite(last)) throw new ExchangeError('bad', 'invalid ticker');
    return { last, changePct: open ? ((last - open) / open) * 100 : 0, volume24h: Number(s.volume), high: Number(s.high), low: Number(s.low) };
  },
};

