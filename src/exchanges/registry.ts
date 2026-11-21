import type { ExchangeAdapter, ExchangeId, SymbolInfo } from './types';
import { coinbase } from './coinbase';
import { kraken } from './kraken';
import { binance } from './binance';
import { okx } from './okx';
import { bybit } from './bybit';

export const ADAPTERS: Record<ExchangeId, ExchangeAdapter> = { coinbase, kraken, binance, okx, bybit };

/**
 * Order used by "automatic" mode. Exchanges that do not serve US residents
 * (Binance, OKX, Bybit) are never used automatically: only on manual choice.
 */
export const AUTO_ORDER: ExchangeId[] = ['coinbase', 'kraken'];

export const MANUAL_ONLY: ExchangeId[] = ['binance', 'okx', 'bybit'];

export const ALL_IDS = Object.keys(ADAPTERS) as ExchangeId[];

export type Preference = 'auto' | ExchangeId;

/** Searches symbols across several exchanges (lists are cached by the caller). */
export async function loadSymbols(ids: ExchangeId[]): Promise<SymbolInfo[]> {
  const results = await Promise.allSettled(ids.map((id) => ADAPTERS[id].buscarSimbolos()));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
