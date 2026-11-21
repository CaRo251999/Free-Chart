import type { Candle } from '../exchanges/types';
import { FIB_LEVELS, type DPoint, type Drawing, type DrawingKind } from './types';

// ---------- time <-> logical index (supports times beyond the loaded candles) ----------

export function timeToLogical(candles: Candle[], step: number, t: number): number | null {
  const n = candles.length;
  if (!n) return null;
  const first = (candles[0] as Candle).time;
  const last = (candles[n - 1] as Candle).time;
  if (t <= first) return (t - first) / step;
  if (t >= last) return n - 1 + (t - last) / step;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((candles[mid] as Candle).time <= t) lo = mid;
    else hi = mid;
  }
  const a = (candles[lo] as Candle).time;
  const b = (candles[lo + 1] as Candle).time;
  return lo + (t - a) / (b - a);
}

export function logicalToTime(candles: Candle[], step: number, l: number): number | null {
  const n = candles.length;
  if (!n) return null;
  if (l <= 0) return (candles[0] as Candle).time + l * step;
  if (l >= n - 1) return (candles[n - 1] as Candle).time + (l - (n - 1)) * step;
  const i = Math.floor(l);
  const a = (candles[i] as Candle).time;
  const b = (candles[i + 1] as Candle).time;
  return a + (l - i) * (b - a);
}

// ---------- layout ----------

export interface Env {
  /** Pixel x for a time (null if not computable). */
  x(time: number): number | null;
  y(price: number): number | null;
  /** Plot-area size in CSS pixels. */
  W: number;
  H: number;
  /** Fractional bar distance between two times. */
  bars(t0: number, t1: number): number;
  fmtPrice(p: number): string;
  barsText(n: number): string;
}

export type Shape =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; dash?: boolean; alpha?: number; color?: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; alpha: number; color?: string; border?: boolean }
  | { t: 'poly'; pts: [number, number][]; alpha: number }
  | { t: 'text'; x: number; y: number; text: string; align?: 'left' | 'right' | 'center'; bg?: boolean; color?: string }
  | { t: 'arrowhead'; x: number; y: number; angle: number };

export interface Layout {
  shapes: Shape[];
  /** Draggable points in pixel space, index-aligned with the leading `drawing.points`. */
  handles: [number, number][];
}

const GREEN = '#22c55e';
const RED = '#ef4444';

/** Completes a freshly placed drawing (long/short get an automatic 1:1 stop). */
export function completePoints(kind: DrawingKind, pts: DPoint[]): DPoint[] {
  if ((kind === 'long' || kind === 'short') && pts.length === 2) {
    const [e, tgt] = pts as [DPoint, DPoint];
    return [e, tgt, { time: tgt.time, price: e.price - (tgt.price - e.price) }];
  }
  if (kind === 'channel' && pts.length === 2) {
    const [a, b] = pts as [DPoint, DPoint];
    return [a, b, { time: b.time, price: b.price }];
  }
  return pts;
}

const pctText = (a: number, b: number) => (a === 0 ? '—' : `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(2)}%`);

export function layout(d: Drawing, env: Env): Layout {
  const px: ([number, number] | null)[] = d.points.map((p) => {
    const x = env.x(p.time);
    const y = env.y(p.price);
    return x === null || y === null ? null : [x, y];
  });
  if (px.some((p) => p === null)) return { shapes: [], handles: [] };
  const P = px as [number, number][];
  const p0 = P[0] as [number, number];
  const p1 = (P[1] ?? p0) as [number, number];
  const shapes: Shape[] = [];
  const { W, H } = env;

  switch (d.kind) {
    case 'trend':
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] });
      return { shapes, handles: [p0, p1] };
    case 'arrow': {
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] });
      shapes.push({ t: 'arrowhead', x: p1[0], y: p1[1], angle: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) });
      return { shapes, handles: [p0, p1] };
    }
    case 'ray': {
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      let x2: number, y2: number;
      if (Math.abs(dx) < 1e-6) {
        x2 = p0[0];
        y2 = dy >= 0 ? H : 0;
      } else {
        x2 = dx > 0 ? W : 0;
        y2 = p0[1] + (dy / dx) * (x2 - p0[0]);
      }
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2, y2 });
      return { shapes, handles: [p0, p1] };
    }
    case 'hline':
      shapes.push({ t: 'line', x1: 0, y1: p0[1], x2: W, y2: p0[1] });
      shapes.push({ t: 'text', x: W - 6, y: p0[1] - 10, text: env.fmtPrice((d.points[0] as DPoint).price), align: 'right' });
      return { shapes, handles: [[Math.min(60, W / 2), p0[1]]] };
    case 'vline':
      shapes.push({ t: 'line', x1: p0[0], y1: 0, x2: p0[0], y2: H });
      return { shapes, handles: [[p0[0], Math.min(60, H / 2)]] };
    case 'rect': {
      const x = Math.min(p0[0], p1[0]);
      const y = Math.min(p0[1], p1[1]);
      shapes.push({ t: 'rect', x, y, w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]), alpha: 0.15, border: true });
      return { shapes, handles: [p0, p1] };
    }
    case 'channel': {
      const p2 = (P[2] ?? p1) as [number, number];
      const dx = p1[0] - p0[0];
      const slope = Math.abs(dx) < 1e-6 ? 0 : (p1[1] - p0[1]) / dx;
      const off = p2[1] - (p0[1] + slope * (p2[0] - p0[0]));
      shapes.push({ t: 'poly', alpha: 0.12, pts: [p0, p1, [p1[0], p1[1] + off], [p0[0], p0[1] + off]] });
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] });
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1] + off, x2: p1[0], y2: p1[1] + off });
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1] + off / 2, x2: p1[0], y2: p1[1] + off / 2, dash: true, alpha: 0.6 });
      return { shapes, handles: [p0, p1, [p2[0], p0[1] + slope * (p2[0] - p0[0]) + off]] };
    }
    case 'fib': {
      const a = (d.points[0] as DPoint).price;
      const b = (d.points[1] as DPoint).price;
      const x1 = Math.min(p0[0], p1[0]);
      const x2 = Math.max(p0[0], p1[0]);
      const ys: number[] = [];
      FIB_LEVELS.forEach((lv, i) => {
        const price = b + (a - b) * lv; // 0 at the end point, 1 at the start point
        const y = env.y(price);
        if (y === null) return;
        ys.push(y);
        shapes.push({ t: 'line', x1, y1: y, x2: Math.max(x2, x1 + 40), y2: y, alpha: 0.8 });
        shapes.push({ t: 'text', x: x1 + 4, y: y - 10, text: `${lv} (${env.fmtPrice(price)})` });
        const prev = ys[i - 1];
        if (prev !== undefined && i > 0 && i % 2 === 1) shapes.push({ t: 'rect', x: x1, y: Math.min(prev, y), w: Math.max(x2, x1 + 40) - x1, h: Math.abs(y - prev), alpha: 0.07 });
      });
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], dash: true, alpha: 0.5 });
      return { shapes, handles: [p0, p1] };
    }
    case 'text': {
      const text = d.text || 'Text';
      shapes.push({ t: 'text', x: p0[0], y: p0[1], text, bg: true });
      return { shapes, handles: [p0] };
    }
    case 'ruler': {
      const a = d.points[0] as DPoint;
      const b = d.points[1] as DPoint;
      const up = b.price >= a.price;
      const color = up ? GREEN : RED;
      shapes.push({ t: 'rect', x: Math.min(p0[0], p1[0]), y: Math.min(p0[1], p1[1]), w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]), alpha: 0.12, color });
      shapes.push({ t: 'line', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], dash: true, color });
      const diff = b.price - a.price;
      const bars = env.bars(a.time, b.time);
      shapes.push({
        t: 'text', x: (p0[0] + p1[0]) / 2, y: Math.min(p0[1], p1[1]) - 14, align: 'center', bg: true, color: '#fff',
        text: `${diff >= 0 ? '+' : '−'}${env.fmtPrice(Math.abs(diff))} (${pctText(a.price, b.price)}) · ${env.barsText(Math.round(Math.abs(bars)))}`,
      });
      return { shapes, handles: [p0, p1] };
    }
    case 'long':
    case 'short': {
      const entry = d.points[0] as DPoint;
      const target = d.points[1] as DPoint;
      const stop = (d.points[2] ?? target) as DPoint;
      const yT = env.y(target.price);
      const yS = env.y(stop.price);
      if (yT === null || yS === null) return { shapes: [], handles: [] };
      const x = Math.min(p0[0], p1[0]);
      const w = Math.max(Math.abs(p1[0] - p0[0]), 30);
      const reward = Math.abs(target.price - entry.price);
      const risk = Math.abs(entry.price - stop.price);
      shapes.push({ t: 'rect', x, y: Math.min(p0[1], yT), w, h: Math.abs(yT - p0[1]), alpha: 0.2, color: GREEN });
      shapes.push({ t: 'rect', x, y: Math.min(p0[1], yS), w, h: Math.abs(yS - p0[1]), alpha: 0.2, color: RED });
      shapes.push({ t: 'line', x1: x, y1: p0[1], x2: x + w, y2: p0[1], color: '#94a3b8' });
      shapes.push({ t: 'text', x: x + w / 2, y: Math.min(p0[1], yT) + 4, align: 'center', color: '#fff', text: `${env.fmtPrice(target.price)} (${pctText(entry.price, target.price)})` });
      shapes.push({ t: 'text', x: x + w / 2, y: Math.max(p0[1], yS) - 18, align: 'center', color: '#fff', text: `${env.fmtPrice(stop.price)} (${pctText(entry.price, stop.price)})` });
      shapes.push({ t: 'text', x: x + w / 2, y: p0[1] - 8, align: 'center', bg: true, color: '#fff', text: `${d.kind === 'long' ? 'Long' : 'Short'} R:R ${risk === 0 ? '∞' : (reward / risk).toFixed(2)}` });
      return { shapes, handles: [p0, [p1[0], yT], [p1[0], yS]] };
    }
  }
}

// ---------- hit testing ----------

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const inPoly = (x: number, y: number, pts: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] as [number, number];
    const [xj, yj] = pts[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export type Hit = { part: 'handle'; index: number } | { part: 'body' } | null;

export function hitTest(d: Drawing, env: Env, x: number, y: number, tol = 7): Hit {
  const { shapes, handles } = layout(d, env);
  for (let i = 0; i < handles.length; i++) {
    const [hx, hy] = handles[i] as [number, number];
    if (Math.hypot(x - hx, y - hy) <= tol + 4) return { part: 'handle', index: i };
  }
  for (const s of shapes) {
    if (s.t === 'line' && distToSegment(x, y, s.x1, s.y1, s.x2, s.y2) <= tol) return { part: 'body' };
    if (s.t === 'rect' && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return { part: 'body' };
    if (s.t === 'poly' && inPoly(x, y, s.pts)) return { part: 'body' };
    if (s.t === 'text' && d.kind === 'text') {
      const w = s.text.length * 7.5 + 10;
      const left = s.align === 'center' ? s.x - w / 2 : s.align === 'right' ? s.x - w : s.x;
      if (x >= left && x <= left + w && y >= s.y - 4 && y <= s.y + 20) return { part: 'body' };
    }
  }
  return null;
}

// ---------- magnet (snap to OHLC) ----------

export interface Snapped extends DPoint {
  snapped: boolean;
}

/** Snaps to the nearest candle's open/high/low/close if the pointer is within `maxPx` of it. */
export function snapToOhlc(
  candles: Candle[],
  step: number,
  env: Pick<Env, 'y'>,
  logical: number,
  rawTime: number,
  rawPrice: number,
  pointerY: number,
  maxPx = 22,
): Snapped {
  const n = candles.length;
  const i = Math.round(logical);
  const c = candles[i];
  void step;
  if (!c || i < 0 || i >= n) return { time: rawTime, price: rawPrice, snapped: false };
  let best: number | null = null;
  let bestD = Infinity;
  for (const price of [c.open, c.high, c.low, c.close]) {
    const y = env.y(price);
    if (y === null) continue;
    const dist = Math.abs(y - pointerY);
    if (dist < bestD) {
      bestD = dist;
      best = price;
    }
  }
  if (best !== null && bestD <= maxPx) return { time: c.time, price: best, snapped: true };
  return { time: c.time, price: rawPrice, snapped: false };
}
