import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeError } from './types';
import { AUTO_ORDER } from './registry';
import { candidateOrder, isDown, markDown, resetHealth, withFallback } from './router';

beforeEach(() => resetHealth());

describe('automatic order', () => {
  it('is Coinbase -> Kraken -> Binance and never includes OKX/Bybit', () => {
    expect(AUTO_ORDER).toEqual(['coinbase', 'kraken', 'binance']);
    expect(AUTO_ORDER).not.toContain('okx');
    expect(AUTO_ORDER).not.toContain('bybit');
  });
  it('puts a manual choice first, then the automatic chain', () => {
    expect(candidateOrder('binance')).toEqual(['binance', 'coinbase', 'kraken']);
    expect(candidateOrder('okx')).toEqual(['okx', 'coinbase', 'kraken', 'binance']);
    expect(candidateOrder('kraken')).toEqual(['kraken', 'coinbase', 'binance']);
    expect(candidateOrder('auto')).toEqual(['coinbase', 'kraken', 'binance']);
  });
});

describe('withFallback', () => {
  it('uses the first exchange when it works', async () => {
    const fn = vi.fn(async (_a, s: string) => s);
    const r = await withFallback({ base: 'BTC', quote: 'USD' }, 'auto', fn);
    expect(r.exchange).toBe('coinbase');
    expect(r.symbol).toBe('BTC-USD');
    expect(r.fellBack).toBe(false);
  });

  it('falls back to Kraken when Coinbase is blocked, and cools Coinbase down', async () => {
    const fn = vi.fn(async (a: { id: string }, s: string) => {
      if (a.id === 'coinbase') throw new ExchangeError('geo', 'blocked', 451);
      return s;
    });
    const r = await withFallback({ base: 'BTC', quote: 'USD' }, 'auto', fn);
    expect(r.exchange).toBe('kraken');
    expect(r.fellBack).toBe(true);
    expect(isDown('coinbase')).toBe(true);
  });

  it('tries equivalent quotes before changing exchange', async () => {
    const seen: string[] = [];
    const fn = async (_a: { id: string }, s: string) => {
      seen.push(s);
      if (s !== 'BTC-USDT') throw new ExchangeError('notfound', 'nope');
      return s;
    };
    const r = await withFallback({ base: 'BTC', quote: 'USD' }, 'auto', fn);
    expect(seen).toEqual(['BTC-USD', 'BTC-USDT']);
    expect(r.pair.quote).toBe('USDT');
  });

  it('manual choice is tried first and falls back if blocked', async () => {
    const order: string[] = [];
    const fn = async (a: { id: string }, s: string) => {
      order.push(a.id);
      if (a.id === 'binance') throw new ExchangeError('geo', 'blocked', 451);
      return s;
    };
    const r = await withFallback({ base: 'BTC', quote: 'USDT' }, 'binance', fn);
    expect(order[0]).toBe('binance');
    expect(r.exchange).toBe('coinbase');
    expect(r.fellBack).toBe(true);
  });

  it('skips exchanges on cool-down', async () => {
    markDown('coinbase');
    const r = await withFallback({ base: 'BTC', quote: 'USD' }, 'auto', async (_a, s) => s);
    expect(r.exchange).toBe('kraken');
  });

  it('throws the last error when everything fails', async () => {
    await expect(
      withFallback({ base: 'BTC', quote: 'USD' }, 'auto', async () => {
        throw new ExchangeError('network', 'down');
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});
