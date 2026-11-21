import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Candle, ExchangeAdapter, HistoryOptions, Interval } from '../exchanges/types';
import { INTERVAL_SECONDS } from '../exchanges/intervals';
import { normalizeCandles } from '../exchanges/candles';

interface Schema extends DBSchema {
  candles: { key: string; value: { key: string; candles: Candle[]; savedAt: number } };
  kv: { key: string; value: { key: string; value: unknown; savedAt: number } };
}

const MAX_STORED = 3000;
const MAX_MEMORY_ENTRIES = 40;
const memory = new Map<string, Candle[]>();
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>('free-chart', 1, {
    upgrade(d) {
      d.createObjectStore('candles', { keyPath: 'key' });
      d.createObjectStore('kv', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

const cacheKey = (ex: string, symbol: string, interval: Interval) => `${ex}|${symbol}|${interval}`;

async function readCache(key: string): Promise<Candle[]> {
  const m = memory.get(key);
  if (m) return m;
  try {
    const row = await (await db()).get('candles', key);
    if (row) {
      remember(key, row.candles);
      return row.candles;
    }
  } catch {
    /* IndexedDB unavailable (private mode): memory-only */
  }
  return [];
}

function remember(key: string, candles: Candle[]) {
  memory.delete(key);
  memory.set(key, candles);
  if (memory.size > MAX_MEMORY_ENTRIES) memory.delete(memory.keys().next().value as string);
}

async function writeCache(key: string, candles: Candle[]) {
  const trimmed = candles.slice(-MAX_STORED);
  remember(key, trimmed);
  try {
    await (await db()).put('candles', { key, candles: trimmed, savedAt: Date.now() });
  } catch {
    /* ignore */
  }
}

/** Generic TTL cache for small JSON blobs (e.g. symbol lists). */
export async function cachedValue<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  try {
    const row = await (await db()).get('kv', key);
    if (row && Date.now() - row.savedAt < ttlMs) return row.value as T;
  } catch {
    /* ignore */
  }
  const value = await load();
  try {
    await (await db()).put('kv', { key, value, savedAt: Date.now() });
  } catch {
    /* ignore */
  }
  return value;
}

/**
 * Candles through the cache. Without `before`: serves cached history and only
 * requests what is missing at the right edge. With `before`: pages older data.
 */
export async function cachedCandles(adapter: ExchangeAdapter, symbol: string, interval: Interval, opts: HistoryOptions = {}): Promise<Candle[]> {
  const key = cacheKey(adapter.id, symbol, interval);
  const want = opts.limit ?? 500;
  const cached = await readCache(key);

  if (opts.before !== undefined) {
    const older = cached.filter((c) => c.time < (opts.before as number));
    if (older.length >= want) return older.slice(-want);
    const fetched = await adapter.velasHistoricas(symbol, interval, opts);
    const merged = normalizeCandles([...cached, ...fetched]);
    await writeCache(key, merged);
    return merged.filter((c) => c.time < (opts.before as number)).slice(-want);
  }

  const last = cached[cached.length - 1];
  if (last && cached.length >= want) {
    const missing = Math.ceil((Date.now() / 1000 - last.time) / INTERVAL_SECONDS[interval]) + 2;
    if (missing <= 1000) {
      const fresh = await adapter.velasHistoricas(symbol, interval, { ...opts, limit: missing });
      const merged = normalizeCandles([...cached, ...fresh]);
      await writeCache(key, merged);
      return merged.slice(-want);
    }
  }
  const fetched = await adapter.velasHistoricas(symbol, interval, opts);
  const merged = normalizeCandles([...cached.filter((c) => fetched[0] && c.time < fetched[0].time), ...fetched]);
  await writeCache(key, merged);
  return merged.slice(-want);
}

export function clearMemoryCache() {
  memory.clear();
}
