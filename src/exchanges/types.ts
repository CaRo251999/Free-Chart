/** Candle time is UTC seconds (lightweight-charts UTCTimestamp). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ExchangeId = 'coinbase' | 'kraken' | 'binance' | 'okx' | 'bybit';
export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type StreamState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SymbolInfo {
  exchange: ExchangeId;
  /** Exchange-native identifier (e.g. "BTC-USD", "XBTUSD", "BTCUSDT"). */
  id: string;
  base: string;
  quote: string;
}

export interface Ticker {
  last: number;
  /** Percentage change over 24h. */
  changePct: number;
  /** 24h volume in base units. */
  volume24h: number;
  high: number;
  low: number;
}

export interface HistoryOptions {
  /** Number of candles wanted (default 500). */
  limit?: number;
  /** Only candles with time < before (UTC seconds), for paging backwards. */
  before?: number;
  signal?: AbortSignal;
}

/**
 * Contract every exchange implements. Names follow SPEC.md
 * (buscarSimbolos, velasHistoricas, streamTiempoReal, ticker24h).
 */
export interface ExchangeAdapter {
  readonly id: ExchangeId;
  readonly name: string;
  /** True if the exchange does not serve US residents (manual choice only, with warning). */
  readonly usRestricted: boolean;
  /** Builds the native id for a pair, e.g. ("BTC","USD") -> "BTC-USD". */
  toNative(base: string, quote: string): string;
  buscarSimbolos(): Promise<SymbolInfo[]>;
  /** Ascending by time. */
  velasHistoricas(symbol: string, interval: Interval, opts?: HistoryOptions): Promise<Candle[]>;
  /** Pushes live candle updates (same time = update, newer time = new candle). Returns unsubscribe. */
  streamTiempoReal(
    symbol: string,
    interval: Interval,
    onCandle: (c: Candle) => void,
    onState?: (s: StreamState) => void,
  ): () => void;
  ticker24h(symbol: string): Promise<Ticker>;
}

export class ExchangeError extends Error {
  constructor(
    public kind: 'geo' | 'rate' | 'network' | 'notfound' | 'bad',
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ExchangeError';
  }
}
