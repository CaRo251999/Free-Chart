import type { Candle, ExchangeAdapter, HistoryOptions, Interval, StreamState, SymbolInfo, Ticker } from './types';
import { getJson } from './http';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket } from './ws';
import { normalizeCandles } from './candles';

// Market-data-only hosts. Binance.com is NOT available to US residents (manual choice only).
const REST = 'https://data-api.binance.vision/api/v3';
const WS = 'wss://data-stream.binance.vision/ws';
const limiter = new RateLimiter(10, 5);

/** Row: [openTime(ms), open, high, low, close, volume, ...] */
export function parseBinanceRow(r: (string | number)[]): Candle {
  return { time: Number(r[0]) / 1000, open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) };
}

async function fetchCandles(symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const want = opts.limit ?? 500;
  let endMs = opts.before !== undefined ? opts.before * 1000 - 1 : undefined;
  const rows: Candle[] = [];
  while (rows.length < want) {
    const n = Math.min(1000, want - rows.length);
    const url = `${REST}/klines?symbol=${symbol}&interval=${interval}&limit=${n}${endMs !== undefined ? `&endTime=${endMs}` : ''}`;
    const page = await getJson<(string | number)[][]>(limiter, url, opts.signal);
    if (!Array.isArray(page) || page.length === 0) break;
    const parsed = page.map(parseBinanceRow);
    rows.push(...parsed);
    endMs = (parsed[0] as Candle).time * 1000 - 1;
    if (page.length < n) break;
  }
  return normalizeCandles(rows).slice(-want);
}

export const binance: ExchangeAdapter = {
  id: 'binance',
  name: 'Binance',
  usRestricted: true,
  toNative: (base, quote) => `${base}${quote}`,

  async buscarSimbolos(): Promise<SymbolInfo[]> {
    const res = await getJson<{ symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string }[] }>(
      limiter,
      `${REST}/exchangeInfo?symbolStatus=TRADING`,
    );
    return res.symbols
      .filter((s) => s.status === 'TRADING')
      .map((s) => ({ exchange: 'binance' as const, id: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));
  },

  velasHistoricas: fetchCandles,

  streamTiempoReal(symbol, interval, onCandle, onState) {
    const sock = new ReconnectingSocket({
      url: `${WS}/${symbol.toLowerCase()}@kline_${interval}`,
      onState: onState as (s: StreamState) => void,
      onMessage: (raw) => {
        const m = JSON.parse(raw) as { k?: { t: number; o: string; h: string; l: string; c: string; v: string } };
        if (!m.k) return;
        onCandle({ time: m.k.t / 1000, open: Number(m.k.o), high: Number(m.k.h), low: Number(m.k.l), close: Number(m.k.c), volume: Number(m.k.v) });
      },
    });
    return () => sock.close();
  },

  async ticker24h(symbol): Promise<Ticker> {
    const t = await getJson<{ lastPrice: string; priceChangePercent: string; volume: string; highPrice: string; lowPrice: string }>(
      limiter,
      `${REST}/ticker/24hr?symbol=${symbol}`,
    );
    return { last: Number(t.lastPrice), changePct: Number(t.priceChangePercent), volume24h: Number(t.volume), high: Number(t.highPrice), low: Number(t.lowPrice) };
  },
};
