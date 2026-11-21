import type { Candle, ExchangeAdapter, HistoryOptions, Interval, StreamState, SymbolInfo, Ticker } from './types';
import { ExchangeError } from './types';
import { getJson } from './http';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket } from './ws';
import { normalizeCandles } from './candles';

// OKX is NOT available to US residents (manual choice only).
const REST = 'https://www.okx.com/api/v5';
const WS = 'wss://ws.okx.com/ws/v5/business';
const limiter = new RateLimiter(10, 5);

const BAR: Record<Interval, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1Dutc', '1w': '1Wutc' };

interface OkxResponse<T> {
  code: string;
  msg: string;
  data: T;
}

const unwrap = <T>(r: OkxResponse<T>): T => {
  if (r.code !== '0') throw new ExchangeError(r.code === '51001' ? 'notfound' : r.code === '50011' ? 'rate' : 'bad', r.msg || `OKX ${r.code}`);
  return r.data;
};

/** Row: [ts(ms), open, high, low, close, vol, volCcy, volCcyQuote, confirm] */
export function parseOkxRow(r: string[]): Candle {
  return { time: Number(r[0]) / 1000, open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) };
}

async function fetchCandles(symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const want = opts.limit ?? 500;
  let afterMs = opts.before !== undefined ? opts.before * 1000 : undefined;
  const rows: Candle[] = [];
  let first = true;
  while (rows.length < want) {
    // /candles serves the most recent 1440 bars (300 per page); /history-candles pages further back (100 per page).
    const path = first && afterMs === undefined ? 'candles' : 'history-candles';
    const size = path === 'candles' ? 300 : 100;
    const url = `${REST}/market/${path}?instId=${symbol}&bar=${BAR[interval]}&limit=${size}${afterMs !== undefined ? `&after=${afterMs}` : ''}`;
    const page = unwrap(await getJson<OkxResponse<string[][]>>(limiter, url, opts.signal));
    first = false;
    if (!page.length) break;
    const parsed = page.map(parseOkxRow);
    rows.push(...parsed);
    afterMs = Math.min(...parsed.map((c) => c.time)) * 1000;
  }
  return normalizeCandles(rows).slice(-want);
}

export const okx: ExchangeAdapter = {
  id: 'okx',
  name: 'OKX',
  usRestricted: true,
  toNative: (base, quote) => `${base}-${quote}`,

  async buscarSimbolos(): Promise<SymbolInfo[]> {
    const data = unwrap(await getJson<OkxResponse<{ instId: string; baseCcy: string; quoteCcy: string; state: string }[]>>(limiter, `${REST}/public/instruments?instType=SPOT`));
    return data.filter((i) => i.state === 'live').map((i) => ({ exchange: 'okx' as const, id: i.instId, base: i.baseCcy, quote: i.quoteCcy }));
  },

  velasHistoricas: fetchCandles,

  streamTiempoReal(symbol, interval, onCandle, onState) {
    const sock = new ReconnectingSocket({
      url: WS,
      onState: onState as (s: StreamState) => void,
      onOpen: (send) => send(JSON.stringify({ op: 'subscribe', args: [{ channel: `candle${BAR[interval]}`, instId: symbol }] })),
      onMessage: (raw) => {
        const m = JSON.parse(raw) as { data?: string[][] };
        if (!m.data) return;
        for (const r of m.data) onCandle(parseOkxRow(r));
      },
    });
    return () => sock.close();
  },

  async ticker24h(symbol): Promise<Ticker> {
    const [t] = unwrap(
      await getJson<OkxResponse<{ last: string; open24h: string; high24h: string; low24h: string; vol24h: string }[]>>(limiter, `${REST}/market/ticker?instId=${symbol}`),
    );
    if (!t) throw new ExchangeError('notfound', 'no ticker');
    const last = Number(t.last);
    const open = Number(t.open24h);
    return { last, changePct: open ? ((last - open) / open) * 100 : 0, volume24h: Number(t.vol24h), high: Number(t.high24h), low: Number(t.low24h) };
  },
};
