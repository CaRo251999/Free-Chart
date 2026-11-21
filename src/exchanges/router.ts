import type { Candle, ExchangeAdapter, ExchangeId, HistoryOptions, Interval, StreamState, Ticker } from './types';
import { ExchangeError } from './types';
import { ADAPTERS, AUTO_ORDER, type Preference } from './registry';
import { equivalentQuotes, type Pair } from './symbols';
import { cachedCandles } from '../data/candleCache';

const COOLDOWN_MS = 5 * 60 * 1000;
const downUntil = new Map<ExchangeId, number>();

export function markDown(id: ExchangeId, now = Date.now()) {
  downUntil.set(id, now + COOLDOWN_MS);
}
export function isDown(id: ExchangeId, now = Date.now()): boolean {
  return (downUntil.get(id) ?? 0) > now;
}
export function resetHealth() {
  downUntil.clear();
}

/** Exchanges to try, in order: the user's pick first, then the automatic chain. */
export function candidateOrder(pref: Preference): ExchangeId[] {
  const list: ExchangeId[] = pref === 'auto' ? [...AUTO_ORDER] : [pref, ...AUTO_ORDER];
  return [...new Set(list)];
}

export interface Routed<T> {
  data: T;
  exchange: ExchangeId;
  /** Exchange-native symbol that actually worked. */
  symbol: string;
  /** Pair actually served (quote may differ, e.g. USD vs USDT). */
  pair: Pair;
  /** True when the result did not come from the preferred exchange. */
  fellBack: boolean;
}

/**
 * Runs `fn` against each candidate exchange until one works. "notfound" tries the
 * next equivalent quote (USD/USDT/USDC) and then the next exchange; geo/network
 * errors put the exchange on a 5-minute cool-down.
 */
export async function withFallback<T>(
  pair: Pair,
  pref: Preference,
  fn: (adapter: ExchangeAdapter, symbol: string) => Promise<T>,
): Promise<Routed<T>> {
  const order = candidateOrder(pref);
  const healthy = order.filter((id) => !isDown(id));
  const tryList = healthy.length ? healthy : order; // everything is "down": try anyway
  let lastErr: unknown = new ExchangeError('notfound', 'no exchange available');
  for (const id of tryList) {
    const adapter = ADAPTERS[id];
    for (const quote of equivalentQuotes(pair.quote)) {
      const symbol = adapter.toNative(pair.base, quote);
      try {
        const data = await fn(adapter, symbol);
        return { data, exchange: id, symbol, pair: { base: pair.base, quote }, fellBack: id !== (pref === 'auto' ? tryList[0] : pref) };
      } catch (e) {
        lastErr = e;
        if (e instanceof ExchangeError && e.kind === 'notfound') continue; // next quote
        if (e instanceof ExchangeError && (e.kind === 'geo' || e.kind === 'network')) markDown(id);
        break; // next exchange
      }
    }
  }
  throw lastErr;
}

export const fetchHistory = (pair: Pair, interval: Interval, pref: Preference, opts?: HistoryOptions): Promise<Routed<Candle[]>> =>
  withFallback(pair, pref, async (a, s) => {
    const c = await cachedCandles(a, s, interval, opts);
    if (!c.length && opts?.before === undefined) throw new ExchangeError('notfound', 'no candles');
    return c;
  });

export const fetchTicker = (pair: Pair, pref: Preference): Promise<Routed<Ticker>> =>
  withFallback(pair, pref, (a, s) => a.ticker24h(s));

/** Live stream on a specific, already-resolved exchange/symbol. */
export function subscribeLive(
  exchange: ExchangeId,
  symbol: string,
  interval: Interval,
  onCandle: (c: Candle) => void,
  onState?: (s: StreamState) => void,
): () => void {
  return ADAPTERS[exchange].streamTiempoReal(symbol, interval, onCandle, onState);
}
