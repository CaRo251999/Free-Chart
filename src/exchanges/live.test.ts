// @vitest-environment node
// Real-network smoke test. Skipped by default; run with:  LIVE=1 npx vitest run src/exchanges/live.test.ts
import { describe, expect, it } from 'vitest';
import { ADAPTERS } from './registry';
import type { ExchangeId, Interval } from './types';

const LIVE = process.env.LIVE === '1';
const CASES: [ExchangeId, string][] = [
  ['coinbase', 'BTC-USD'],
  ['kraken', 'BTC/USD'],
  ['binance', 'BTCUSDT'],
  ['okx', 'BTC-USDT'],
];

describe.skipIf(!LIVE)('live exchanges', () => {
  for (const [id, sym] of CASES) {
    const a = ADAPTERS[id];
    for (const iv of ['1m', '1h', '4h', '1d', '1w'] as Interval[]) {
      it(`${id} ${iv} candles`, async () => {
        const c = await a.velasHistoricas(sym, iv, { limit: 50 });
        expect(c.length).toBeGreaterThan(5);
        const s = c.map((x) => x.time);
        expect(s).toEqual([...s].sort((x, y) => x - y));
        expect(c.every((x) => x.high >= x.low && x.volume >= 0)).toBe(true);
      }, 30000);
    }
    it(`${id} ticker24h`, async () => {
      const t = await a.ticker24h(sym);
      expect(t.last).toBeGreaterThan(0);
      expect(Number.isFinite(t.changePct)).toBe(true);
    }, 30000);
    it(`${id} symbols`, async () => {
      expect((await a.buscarSimbolos()).length).toBeGreaterThan(50);
    }, 60000);
    it(`${id} older page via before`, async () => {
      const first = await a.velasHistoricas(sym, '1h', { limit: 20 });
      const older = await a.velasHistoricas(sym, '1h', { limit: 20, before: first[0]!.time });
      expect(older.length).toBeGreaterThan(0);
      expect(older[older.length - 1]!.time).toBeLessThan(first[0]!.time);
    }, 30000);
    it(`${id} websocket delivers a candle`, async () => {
      const got = await new Promise<boolean>((resolve) => {
        const stop = a.streamTiempoReal(sym, '1m', (c) => { stop(); resolve(c.close > 0); });
        setTimeout(() => { stop(); resolve(false); }, 45000);
      });
      expect(got).toBe(true);
    }, 60000);
  }
});
