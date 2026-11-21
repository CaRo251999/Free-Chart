import type { ExchangeId, SymbolInfo } from '../exchanges/types';
import { ADAPTERS, ALL_IDS } from '../exchanges/registry';
import { cachedValue } from './candleCache';
import { normalizeBase } from '../exchanges/symbols';

const TTL = 12 * 60 * 60 * 1000;

export interface PairEntry {
  base: string;
  quote: string;
  exchanges: ExchangeId[];
}

let indexPromise: Promise<PairEntry[]> | null = null;

/** Symbol lists from every exchange, cached 12h in IndexedDB; failures just skip that exchange. */
export function loadPairIndex(): Promise<PairEntry[]> {
  indexPromise ??= (async () => {
    const lists = await Promise.all(
      ALL_IDS.map((id) =>
        cachedValue<SymbolInfo[]>(`symbols:${id}`, TTL, () => ADAPTERS[id].buscarSimbolos()).catch(() => [] as SymbolInfo[]),
      ),
    );
    const map = new Map<string, PairEntry>();
    for (const s of lists.flat()) {
      const base = normalizeBase(s.base);
      const key = `${base}/${s.quote}`;
      const e = map.get(key);
      if (e) {
        if (!e.exchanges.includes(s.exchange)) e.exchanges.push(s.exchange);
      } else {
        map.set(key, { base, quote: s.quote, exchanges: [s.exchange] });
      }
    }
    return [...map.values()];
  })();
  return indexPromise;
}

const QUOTE_RANK: Record<string, number> = { USD: 0, USDT: 1, USDC: 2, EUR: 3, BTC: 4 };

/** Ranks matches: exact base, base prefix, pair contains; common quotes and more exchanges first. */
export function searchPairs(index: PairEntry[], query: string, limit = 60): PairEntry[] {
  const q = query.trim().toUpperCase().replace(/[-_ ]/g, '/');
  if (!q) {
    return index.filter((e) => ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA'].includes(e.base) && (e.quote === 'USD' || e.quote === 'USDT')).slice(0, limit);
  }
  const scored: [number, PairEntry][] = [];
  for (const e of index) {
    const full = `${e.base}/${e.quote}`;
    let s = -1;
    if (full === q || e.base === q) s = 0;
    else if (full.startsWith(q)) s = 1;
    else if (e.base.startsWith(q)) s = 2;
    else if (full.includes(q)) s = 3;
    if (s < 0) continue;
    scored.push([s * 100 + (QUOTE_RANK[e.quote] ?? 9) * 5 - e.exchanges.length, e]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}
