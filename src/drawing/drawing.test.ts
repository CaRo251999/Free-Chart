import { describe, expect, it } from 'vitest';
import type { Candle } from '../exchanges/types';
import { completePoints, distToSegment, hitTest, layout, logicalToTime, snapToOhlc, timeToLogical, type Env, type Shape } from './geometry';
import { History } from './history';
import type { Drawing } from './types';

const env: Env = {
  x: (t) => t / 10, // 1 px per 10 s
  y: (p) => 1000 - p, // price 1000 at the top
  W: 800,
  H: 600,
  bars: (a, b) => (b - a) / 3600,
  fmtPrice: (p) => p.toFixed(2),
  barsText: (n) => `${n} bars`,
};

const D = (kind: Drawing['kind'], pts: [number, number][], extra: Partial<Drawing> = {}): Drawing => ({
  id: 'd', kind, color: '#fff', width: 2, points: pts.map(([time, price]) => ({ time, price })), ...extra,
});
const texts = (shapes: Shape[]) => shapes.filter((s): s is Extract<Shape, { t: 'text' }> => s.t === 'text').map((s) => s.text);

const candles: Candle[] = [0, 3600, 7200, 14400].map((time, i) => ({ time, open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i, volume: 1 })); // gap before the last

describe('time <-> logical', () => {
  it('maps inside, before and after the data', () => {
    expect(timeToLogical(candles, 3600, 3600)).toBe(1);
    expect(timeToLogical(candles, 3600, 1800)).toBeCloseTo(0.5);
    expect(timeToLogical(candles, 3600, -7200)).toBe(-2);
    expect(timeToLogical(candles, 3600, 14400 + 7200)).toBe(5);
    expect(timeToLogical(candles, 3600, 10800)).toBeCloseTo(2.5); // inside the gap
  });
  it('round-trips', () => {
    for (const t of [-5000, 0, 1234, 7200, 9000, 14400, 30000]) {
      const l = timeToLogical(candles, 3600, t) as number;
      expect(logicalToTime(candles, 3600, l)).toBeCloseTo(t, 6);
    }
  });
  it('returns null without candles', () => {
    expect(timeToLogical([], 60, 5)).toBeNull();
  });
});

describe('layout', () => {
  it('trend line connects both points and exposes handles', () => {
    const l = layout(D('trend', [[1000, 100], [3000, 300]]), env);
    expect(l.shapes[0]).toMatchObject({ t: 'line', x1: 100, y1: 900, x2: 300, y2: 700 });
    expect(l.handles).toEqual([[100, 900], [300, 700]]);
  });
  it('ray is extended to the plot edge in the drawing direction', () => {
    const l = layout(D('ray', [[1000, 100], [3000, 300]]), env);
    const line = l.shapes[0] as Extract<Shape, { t: 'line' }>;
    expect(line.x2).toBe(800);
    expect(line.y2).toBeCloseTo(900 - 700); // slope -1 px/px
  });
  it('horizontal and vertical lines span the whole plot', () => {
    const h = layout(D('hline', [[0, 250]]), env).shapes[0] as Extract<Shape, { t: 'line' }>;
    expect([h.x1, h.x2, h.y1]).toEqual([0, 800, 750]);
    const v = layout(D('vline', [[2000, 0]]), env).shapes[0] as Extract<Shape, { t: 'line' }>;
    expect([v.y1, v.y2, v.x1]).toEqual([0, 600, 200]);
  });
  it('fibonacci draws 7 levels with correct prices', () => {
    const l = layout(D('fib', [[1000, 100], [3000, 200]]), env);
    expect(l.shapes.filter((s) => s.t === 'line' && !s.dash)).toHaveLength(7);
    expect(texts(l.shapes)).toContain('0.5 (150.00)');
    expect(texts(l.shapes)).toContain('0.618 (138.20)');
  });
  it('ruler reports price, percent and bars', () => {
    const l = layout(D('ruler', [[0, 100], [36000, 110]]), env);
    expect(texts(l.shapes)[0]).toBe('+10.00 (+10.00%) · 10 bars');
    const down = layout(D('ruler', [[0, 100], [7200, 90]]), env);
    expect(texts(down.shapes)[0]).toContain('−10.00 (-10.00%)');
  });
  it('long position: auto stop gives 1:1, moving the stop changes R:R', () => {
    const pts = completePoints('long', [{ time: 0, price: 100 }, { time: 36000, price: 110 }]);
    expect(pts[2]?.price).toBe(90);
    const l1 = layout({ ...D('long', []), points: pts }, env);
    expect(texts(l1.shapes).some((t) => t === 'Long R:R 1.00')).toBe(true);
    const l2 = layout({ ...D('long', []), points: [pts[0]!, pts[1]!, { time: 36000, price: 95 }] }, env);
    expect(texts(l2.shapes).some((t) => t === 'Long R:R 2.00')).toBe(true);
    expect(l2.handles).toHaveLength(3);
  });
  it('short position works downwards', () => {
    const pts = completePoints('short', [{ time: 0, price: 100 }, { time: 3600, price: 90 }]);
    expect(pts[2]?.price).toBe(110);
    expect(texts(layout({ ...D('short', []), points: pts }, env).shapes)).toContain('Short R:R 1.00');
  });
  it('channel offsets a parallel line through the third point', () => {
    const l = layout(D('channel', [[0, 100], [4000, 100], [2000, 150]]), env);
    const lines = l.shapes.filter((s): s is Extract<Shape, { t: 'line' }> => s.t === 'line' && !s.dash);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.y1).toBe(850);
  });
  it('is empty when a point cannot be placed', () => {
    const none: Env = { ...env, x: () => null };
    expect(layout(D('trend', [[0, 1], [1, 2]]), none)).toEqual({ shapes: [], handles: [] });
  });
});

describe('hit testing', () => {
  const trend = D('trend', [[1000, 100], [3000, 300]]); // pixels (100,900) -> (300,700)
  it('hits handles before the body', () => {
    expect(hitTest(trend, env, 101, 899)).toEqual({ part: 'handle', index: 0 });
    expect(hitTest(trend, env, 299, 701)).toEqual({ part: 'handle', index: 1 });
  });
  it('hits the line body within tolerance only', () => {
    expect(hitTest(trend, env, 200, 803)).toEqual({ part: 'body' });
    expect(hitTest(trend, env, 200, 760)).toBeNull();
  });
  it('hits inside rectangles and channels', () => {
    expect(hitTest(D('rect', [[1000, 100], [3000, 300]]), env, 200, 800)).toEqual({ part: 'body' });
    expect(hitTest(D('channel', [[0, 100], [4000, 100], [2000, 150]]), env, 200, 875)).toEqual({ part: 'body' });
    expect(hitTest(D('rect', [[1000, 100], [3000, 300]]), env, 50, 800)).toBeNull();
  });
  it('hits text boxes', () => {
    expect(hitTest(D('text', [[1000, 100]], { text: 'hello' }), env, 110, 905)).toEqual({ part: 'body' });
  });
  it('distToSegment clamps to the endpoints', () => {
    expect(distToSegment(0, 0, 3, 0, 6, 0)).toBe(3);
    expect(distToSegment(4, 3, 0, 0, 8, 0)).toBe(3);
  });
});

describe('snapToOhlc', () => {
  it('snaps price to the nearest OHLC value when close enough', () => {
    const c: Candle[] = [{ time: 0, open: 100, high: 110, low: 90, close: 105, volume: 1 }, { time: 3600, open: 105, high: 120, low: 100, close: 115, volume: 1 }];
    const s = snapToOhlc(c, 3600, env, 1.2, 4000, 119, 1000 - 119);
    expect(s).toEqual({ time: 3600, price: 120, snapped: true });
  });
  it('still snaps the time but keeps the raw price when far from any OHLC', () => {
    const c: Candle[] = [{ time: 0, open: 100, high: 110, low: 90, close: 105, volume: 1 }];
    const s = snapToOhlc(c, 3600, env, 0.2, 500, 300, 700);
    expect(s).toEqual({ time: 0, price: 300, snapped: false });
  });
  it('does not snap outside the loaded candles', () => {
    const c: Candle[] = [{ time: 0, open: 1, high: 2, low: 0, close: 1, volume: 1 }];
    expect(snapToOhlc(c, 3600, env, 5, 99999, 1, 999).snapped).toBe(false);
  });
});

describe('History', () => {
  it('undo / redo walk through states', () => {
    const h = new History<string>();
    h.record('a'); // a -> b
    h.record('b'); // b -> c
    expect(h.canUndo).toBe(true);
    expect(h.undo('c')).toBe('b');
    expect(h.undo('b')).toBe('a');
    expect(h.undo('a')).toBeUndefined();
    expect(h.redo('a')).toBe('b');
    expect(h.redo('b')).toBe('c');
    expect(h.redo('c')).toBeUndefined();
  });
  it('a new change clears the redo stack and the limit is respected', () => {
    const h = new History<number>(3);
    [1, 2, 3, 4].forEach((n) => h.record(n));
    expect(h.undo(5)).toBe(4);
    h.record(9);
    expect(h.canRedo).toBe(false);
    let count = 0;
    let cur = 9;
    for (let u = h.undo(cur); u !== undefined; u = h.undo(cur)) { cur = u; count++; }
    expect(count).toBe(3);
  });
});
