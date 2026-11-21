import { signal } from '@preact/signals';
import type { Ticker } from '../exchanges/types';
import { fetchTicker } from '../exchanges/router';
import { itemKey, type WItem } from './store';

export interface TickerEntry {
  ticker: Ticker;
  /** 24h volume expressed in quote currency (comparable between assets). */
  quoteVolume: number;
}

export const tickers = signal<Record<string, TickerEntry>>({});

const CONCURRENCY = 3;

/** Refreshes tickers for the given items (rate limiting is handled per exchange). */
export async function refreshTickers(items: WItem[]): Promise<void> {
  const queue = items.slice();
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      try {
        const r = await fetchTicker({ base: it.base, quote: it.quote }, it.pref ?? 'auto');
        tickers.value = { ...tickers.value, [itemKey(it)]: { ticker: r.data, quoteVolume: r.data.volume24h * r.data.last } };
      } catch {
        /* leave the previous value; the row shows "—" if there never was one */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}
