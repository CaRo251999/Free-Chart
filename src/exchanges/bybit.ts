import type { Candle, ExchangeAdapter, HistoryOptions, Interval, StreamState, SymbolInfo, Ticker } from './types';
import { ExchangeError } from './types';
import { getJson } from './http';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket } from './ws';
import { normalizeCandles } from './candles';

/**
 * Bybit (spot, V5). NOT available to US residents, and the endpoint answered 403
 * from the test network (see NOTES.md), so it is manual-only and unverified live.
 */
const REST = 'https://api.bybit.com/v5/market';
const WS = 'wss://stream.bybit.com/v5/public/spot';
const limiter = new RateLimiter(10, 5);

const BAR: Record<Interval, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

const unwrap = <T>(r: BybitResponse<T>): T => {
  if (r.retCode !== 0) throw new ExchangeError(r.retCode === 10001 ? 'notfound' : 'bad', r.retMsg);
  return r.result;
};

/** Row: [startTime(ms), open, high, low, close, volume, turnover] */
export function parseBybitRow(r: string[]): Candle {
  return { time: Number(r[0]) / 1000, open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) };
}

async function fetchCandles(symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const want = opts.limit ?? 500;
  let endMs = opts.before !== undefined ? opts.before * 1000 - 1 : undefined;
  const rows: Candle[] = [];
  while (rows.length < want) {
    const url = `${REST}/kline?category=spot&symbol=${symbol}&interval=${BAR[interval]}&limit=1000${endMs !== undefined ? `&end=${endMs}` : ''}`;
    const res = unwrap(await getJson<BybitResponse<{ list: string[][] }>>(limiter, url, opts.signal));
    if (!res.list.length) break;
    const parsed = res.list.map(parseBybitRow);
    rows.push(...parsed);
    endMs = Math.min(...parsed.map((c) => c.time)) * 1000 - 1;
  }
  return normalizeCandles(rows).slice(-want);
}

export const bybit: ExchangeAdapter = {
  id: 'bybit',
  name: 'Bybit',
  usRestricted: true,
  toNative: (base, quote) => `${base}${quote}`,

  async buscarSimbolos(): Promise<SymbolInfo[]> {
    const res = unwrap(await getJson<BybitResponse<{ list: { symbol: string; baseCoin: string; quoteCoin: string; status: string }[] }>>(limiter, `${REST}/instruments-info?category=spot`));
    return res.list.filter((s) => s.status === 'Trading').map((s) => ({ exchange: 'bybit' as const, id: s.symbol, base: s.baseCoin, quote: s.quoteCoin }));
  },

  velasHistoricas: fetchCandles,

  streamTiempoReal(symbol, interval, onCandle, onState) {
    const sock = new ReconnectingSocket({
      url: WS,
      onState: onState as (s: StreamState) => void,
      onOpen: (send) => send(JSON.stringify({ op: 'subscribe', args: [`kline.${BAR[interval]}.${symbol}`] })),
      onMessage: (raw) => {
        const m = JSON.parse(raw) as { data?: { start: number; open: string; high: string; low: string; close: string; volume: string }[] };
        for (const k of m.data ?? []) {
          onCandle({ time: k.start / 1000, open: Number(k.open), high: Number(k.high), low: Number(k.low), close: Number(k.close), volume: Number(k.volume) });
        }
      },
    });
    return () => sock.close();
  },

  async ticker24h(symbol): Promise<Ticker> {
    const res = unwrap(
      await getJson<BybitResponse<{ list: { lastPrice: string; price24hPcnt: string; volume24h: string; highPrice24h: string; lowPrice24h: string }[] }>>(
        limiter,
        `${REST}/tickers?category=spot&symbol=${symbol}`,
      ),
    );
    const t = res.list[0];
    if (!t) throw new ExchangeError('notfound', 'no ticker');
    return { last: Number(t.lastPrice), changePct: Number(t.price24hPcnt) * 100, volume24h: Number(t.volume24h), high: Number(t.highPrice24h), low: Number(t.lowPrice24h) };
  },
};
