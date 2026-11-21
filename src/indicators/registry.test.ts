import { describe, expect, it } from 'vitest';
import type { Candle } from '../exchanges/types';
import { BY_ID, INDICATORS, defaultParams, newInstance, sanitizeParams } from './registry';
import { sanitizeInstances } from './state';
import { toPoints } from '../chart/indicatorManager';

const candles: Candle[] = Array.from({ length: 150 }, (_, i) => {
  const base = 100 + 10 * Math.sin(i / 6) + i * 0.1;
  return { time: i * 3600, open: base, high: base + 2, low: base - 2, close: base + Math.cos(i), volume: 10 + (i % 5) };
});

describe('indicator registry', () => {
  it('covers every indicator required by the spec', () => {
    const ids = INDICATORS.map((d) => d.id);
    for (const id of ['sma', 'ema', 'wma', 'vwap', 'bb', 'ichimoku', 'supertrend', 'psar', 'rsi', 'macd', 'stochrsi', 'atr', 'obv', 'adx', 'volume']) {
      expect(ids).toContain(id);
    }
    expect(INDICATORS.filter((d) => d.placement === 'overlay')).toHaveLength(8);
    expect(INDICATORS.filter((d) => d.placement === 'pane')).toHaveLength(7);
  });

  it('every definition computes every declared line with default params', () => {
    for (const def of INDICATORS) {
      const out = def.compute(candles, defaultParams(def));
      for (const line of def.lines) {
        const s = out[line.key];
        expect(s, `${def.id}.${line.key}`).toBeDefined();
        expect(s).toHaveLength(candles.length);
        expect(s?.some((v) => v !== null && Number.isFinite(v)), `${def.id}.${line.key} has values`).toBe(true);
      }
    }
  });

  it('survives very short histories', () => {
    for (const def of INDICATORS) expect(() => def.compute(candles.slice(0, 3), defaultParams(def))).not.toThrow();
    for (const def of INDICATORS) expect(() => def.compute([], defaultParams(def))).not.toThrow();
  });

  it('instances carry default colours per line', () => {
    const i = newInstance('macd', 'u1');
    expect(i.colors).toHaveLength(BY_ID.macd?.lines.length as number);
  });
});

describe('sanitizing stored data', () => {
  it('clamps params and drops unknown indicators', () => {
    const def = BY_ID.sma!;
    expect(sanitizeParams(def, { period: 99999 }).period).toBe(500);
    expect(sanitizeParams(def, { period: 'abc' }).period).toBe(20);
    const out = sanitizeInstances([{ id: 'sma', params: { period: -4 }, colors: ['red', '#112233'], width: 99 }, { id: 'evil' }, null]);
    expect(out).toHaveLength(1);
    expect(out[0]?.params.period).toBe(1);
    expect(out[0]?.colors[0]).toBe('#f59e0b'); // invalid colour replaced with default
    expect(out[0]?.width).toBe(4);
  });
});

describe('toPoints', () => {
  it('skips nulls and extrapolates future times for forward offsets', () => {
    const c = candles.slice(0, 5);
    const pts = toPoints(c, [null, 1, 2, 3, 4], 3600, 2);
    expect(pts[0]?.time).toBe(3 * 3600); // index 1 + 2
    expect(pts[pts.length - 1]?.time).toBe(6 * 3600); // two bars beyond the last candle (time 4h)
  });
  it('drops points shifted before the first candle', () => {
    const pts = toPoints(candles.slice(0, 5), [1, 2, 3, 4, 5], 3600, -2);
    expect(pts.map((p) => p.value)).toEqual([3, 4, 5]);
    expect(pts[0]?.time).toBe(0);
  });
});
