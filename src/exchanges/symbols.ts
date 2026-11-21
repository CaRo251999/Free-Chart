/** Normalizes exchange-specific asset codes to the common ticker. */
const ALIASES: Record<string, string> = { XBT: 'BTC', XDG: 'DOGE', XXBT: 'BTC', XETH: 'ETH', XXDG: 'DOGE' };

export function normalizeBase(code: string): string {
  const c = code.toUpperCase();
  return ALIASES[c] ?? c;
}

/** Quote currencies that are interchangeable for fallback purposes. */
const EQUIVALENT_QUOTES: string[][] = [['USD', 'USDT', 'USDC']];

export function equivalentQuotes(quote: string): string[] {
  const q = quote.toUpperCase();
  const group = EQUIVALENT_QUOTES.find((g) => g.includes(q));
  return group ? [q, ...group.filter((x) => x !== q)] : [q];
}

export interface Pair {
  base: string;
  quote: string;
}

export const pairKey = (p: Pair) => `${p.base}/${p.quote}`;

export function parsePairKey(key: string): Pair {
  const [base = '', quote = ''] = key.split('/');
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}
