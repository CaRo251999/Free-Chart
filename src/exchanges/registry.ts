import type { ExchangeAdapter, ExchangeId, SymbolInfo } from './types';
import { coinbase } from './coinbase';
import { kraken } from './kraken';
import { binance } from './binance';
import { okx } from './okx';
import { bybit } from './bybit';

export const ADAPTERS: Record<ExchangeId, ExchangeAdapter> = { coinbase, kraken, binance, okx, bybit };

/**
 * Order used by "automatic" mode: Coinbase -> Kraken -> Binance. Binance is only a last resort
 * (it is not available to US residents; the UI warns when it ends up serving a pair).
 * OKX and Bybit are never used automatically.
 */
export const AUTO_ORDER: ExchangeId[] = ['coinbase', 'kraken', 'binance'];

export const MANUAL_ONLY: ExchangeId[] = ['okx', 'bybit'];

export const ALL_IDS = Object.keys(ADAPTERS) as ExchangeId[];

export type Preference = 'auto' | ExchangeId;

/** Searches symbols across several exchanges (lists are cached by the caller). */
export async function loadSymbols(ids: ExchangeId[]): Promise<SymbolInfo[]> {
  const results = await Promise.allSettled(ids.map((id) => ADAPTERS[id].buscarSimbolos()));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
