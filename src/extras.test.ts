import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, restoreBackup } from './data/backup';
import { dumpAll, save, load } from './data/storage';
import { sanitizeAlerts, shouldTrigger } from './alerts/store';
import { candleAt } from './chart/crosshairSync';
import type { Candle } from './exchanges/types';

beforeEach(() => localStorage.clear());

describe('backup', () => {
  it('round-trips every stored key', () => {
    save('watchlists', [{ id: 'a', name: 'x', items: [] }]);
    save('drawings:BTC/USD', [{ id: 'd', kind: 'hline' }]);
    save('theme', 'light');
    const text = JSON.stringify(buildBackup());
    localStorage.clear();
    expect(dumpAll()).toEqual({});
    restoreBackup(parseBackup(text));
    expect(load('theme', 'dark')).toBe('light');
    expect(load<unknown[]>('drawings:BTC/USD', [])).toHaveLength(1);
    expect(load<unknown[]>('watchlists', [])).toHaveLength(1);
  });

  it('rejects files that are not Free Chart backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('nope')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'free-chart', version: 2, data: { a: 1 } }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'free-chart', version: 1, data: {} }))).toThrow();
  });

  it('drops keys with unsafe names', () => {
    const b = parseBackup(JSON.stringify({ app: 'free-chart', version: 1, data: { ok: 1, '__proto__x<script>': 2, 'a b': 3 } }));
    expect(Object.keys(b.data)).toEqual(['ok']);
  });
});

describe('alerts', () => {
  it('triggers when the price reaches or crosses the level', () => {
    expect(shouldTrigger({ dir: 'above', price: 100 }, 99.9)).toBe(false);
    expect(shouldTrigger({ dir: 'above', price: 100 }, 100)).toBe(true);
    expect(shouldTrigger({ dir: 'above', price: 100 }, 120)).toBe(true);
    expect(shouldTrigger({ dir: 'below', price: 100 }, 100.1)).toBe(false);
    expect(shouldTrigger({ dir: 'below', price: 100 }, 99)).toBe(true);
  });
  it('does not fire again once triggered, and ignores bad prices', () => {
    expect(shouldTrigger({ dir: 'above', price: 100, triggered: 1 }, 500)).toBe(false);
    expect(shouldTrigger({ dir: 'above', price: 100 }, NaN)).toBe(false);
  });
  it('sanitizes stored alerts', () => {
    const out = sanitizeAlerts([
      { base: 'btc', quote: 'usd', price: 100, dir: 'above' },
      { base: 'btc', quote: 'usd', price: -1, dir: 'above' },
      { base: '<x>', quote: 'usd', price: 1, dir: 'above' },
      { base: 'eth', quote: 'usd', price: 5, dir: 'sideways' },
      { base: 'eth', quote: 'usd', price: 5, dir: 'below', pref: 'nope' },
      null,
    ]);
    expect(out.map((a) => `${a.base}/${a.quote}:${a.dir}`)).toEqual(['BTC/USD:above', 'ETH/USD:below']);
    expect(out[1]?.pref).toBeUndefined();
  });
});

describe('candleAt', () => {
  const c: Candle[] = [10, 20, 30, 40].map((time) => ({ time, open: 1, high: 1, low: 1, close: time / 10, volume: 1 }));
  it('finds exact times only', () => {
    expect(candleAt(c, 30)?.close).toBe(3);
    expect(candleAt(c, 10)?.close).toBe(1);
    expect(candleAt(c, 25)).toBeUndefined();
    expect(candleAt([], 1)).toBeUndefined();
  });
});
