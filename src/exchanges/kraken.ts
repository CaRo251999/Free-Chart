import type { Candle, ExchangeAdapter, HistoryOptions, Interval, StreamState, SymbolInfo, Ticker } from './types';
import { ExchangeError } from './types';
import { getJson } from './http';
import { RateLimiter } from './rateLimiter';
import { ReconnectingSocket } from './ws';
import { CandleBuilder, aggregateCandles, normalizeCandles } from './candles';
import { normalizeBase } from './symbols';

const REST = 'https://api.kraken.com/0/public';
const WS = 'wss://ws.kraken.com/v2';
const limiter = new RateLimiter(5, 1); // conservative: ~1 req/s sustained

/** Minutes per native OHLC interval. 1w is aggregated from daily candles. */
const MINUTES: Record<Interval, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440, '1w': 1440 };

interface KrakenResponse<T> {
  error: string[];
  result: T;
}

const unwrap = <T>(r: KrakenResponse<T>): T => {
  if (r.error?.length) {
    const msg = r.error.join(', ');
    throw new ExchangeError(/Unknown asset pair/i.test(msg) ? 'notfound' : /rate limit/i.test(msg) ? 'rate' : 'bad', msg);
  }
  return r.result;
};

/** Row: [time, open, high, low, close, vwap, volume, count] */
export function parseKrakenRow(r: (string | number)[]): Candle {
  return { time: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[6]) };
}

async function fetchCandles(symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const url = `${REST}/OHLC?pair=${symbol}&interval=${MINUTES[interval]}`;
  const result = unwrap(await getJson<KrakenResponse<Record<string, (string | number)[][] | number>>>(limiter, url, opts.signal));
  const key = Object.keys(result).find((k) => k !== 'last');
  const rows = key ? (result[key] as (string | number)[][]) : [];
  let out = normalizeCandles(rows.map(parseKrakenRow));
  if (opts.before !== undefined) out = out.filter((c) => c.time < (opts.before as number));
  if (interval === '1w') out = aggregateCandles(out, '1w');
  return out.slice(-(opts.limit ?? 500));
}

export const kraken: ExchangeAdapter = {
  id: 'kraken',
  name: 'Kraken',
  usRestricted: false,
  toNative: (base, quote) => `${base}/${quote}`,

  async buscarSimbolos(): Promise<SymbolInfo[]> {
    const res = unwrap(await getJson<KrakenResponse<Record<string, { wsname?: string; status?: string }>>>(limiter, `${REST}/AssetPairs`));
    const out: SymbolInfo[] = [];
    for (const p of Object.values(res)) {
      if (!p.wsname || p.status !== 'online') continue;
      const [b = '', q = ''] = p.wsname.split('/');
      const base = normalizeBase(b);
      out.push({ exchange: 'kraken', id: `${base}/${q}`, base, quote: q });
    }
    return out;
  },

  velasHistoricas: fetchCandles,

  streamTiempoReal(symbol, interval, onCandle, onState) {
    let builder: CandleBuilder | null = null;
    let closed = false;
    const native = interval !== '1w';
    if (!native) {
      fetchCandles(symbol, interval, { limit: 1 })
        .then((c) => { if (!closed) builder = new CandleBuilder(interval, c[c.length - 1] ?? null); })
        .catch(() => { if (!closed) builder = new CandleBuilder(interval, null); });
    }
    const sock = new ReconnectingSocket({
      url: WS,
      onState: onState as (s: StreamState) => void,
      onOpen: (send) =>
        send(
          JSON.stringify(
            native
              ? { method: 'subscribe', params: { channel: 'ohlc', symbol: [symbol], interval: MINUTES[interval] } }
              : { method: 'subscribe', params: { channel: 'trade', symbol: [symbol] } },
          ),
        ),
      onMessage: (raw) => {
        const m = JSON.parse(raw) as { channel?: string; type?: string; data?: Record<string, unknown>[] };
        if (!m.data || m.type === 'snapshot' && !native) return;
        if (m.channel === 'ohlc') {
          for (const d of m.data) {
            onCandle({
              time: Date.parse(String(d.interval_begin)) / 1000,
              open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), volume: Number(d.volume),
            });
          }
        } else if (m.channel === 'trade' && builder) {
          for (const d of m.data) onCandle(builder.tick(Number(d.price), Number(d.qty), Date.parse(String(d.timestamp)) / 1000));
        }
      },
    });
    return () => { closed = true; sock.close(); };
  },

  async ticker24h(symbol): Promise<Ticker> {
    const res = unwrap(
      await getJson<KrakenResponse<Record<string, { c: string[]; o: string; h: string[]; l: string[]; v: string[] }>>>(limiter, `${REST}/Ticker?pair=${symbol}`),
    );
    const t = Object.values(res)[0];
    if (!t) throw new ExchangeError('notfound', 'no ticker');
    const last = Number(t.c[0]);
    const open = Number(t.o); // Kraken exposes today's (UTC) open, not a rolling 24h open
    return { last, changePct: open ? ((last - open) / open) * 100 : 0, volume24h: Number(t.v[1]), high: Number(t.h[1]), low: Number(t.l[1]) };
  },
};
