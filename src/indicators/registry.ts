import type { Candle } from '../exchanges/types';
import { ADX, ATR, BOLLINGER, EMA, ICHIMOKU, MACD, OBV, PSAR, RSI, SMA, STOCHRSI, SUPERTREND, VWAP, WMA } from './calc';
import type { Series } from './math';

export interface ParamDef {
  key: string;
  label: string;
  def: number;
  min: number;
  max: number;
  step?: number;
}

export interface LineSpec {
  key: string;
  label: string;
  color: string;
  kind: 'line' | 'histogram' | 'dots';
  /** Histograms: positive values use the line colour, negative values red. Volume colours by candle direction. */
  signed?: boolean;
  byCandle?: boolean;
  /** Shift in bars: >0 draws ahead of the last candle (Ichimoku spans), <0 behind (Chikou). */
  offsetParam?: { key: string; sign: 1 | -1 };
}

export interface IndicatorDef {
  id: string;
  name: string;
  placement: 'overlay' | 'pane';
  params: ParamDef[];
  lines: LineSpec[];
  /** Fixed value range and guide lines for oscillators. */
  range?: [number, number];
  levels?: number[];
  compute(c: Candle[], p: Record<string, number>): Record<string, Series>;
}

const P = (key: string, label: string, def: number, min = 1, max = 500, step = 1): ParamDef => ({ key, label, def, min, max, step });
const L = (key: string, label: string, color: string, extra: Partial<LineSpec> = {}): LineSpec => ({ key, label, color, kind: 'line', ...extra });

const period = [P('period', 'period', 20)];

export const INDICATORS: IndicatorDef[] = [
  { id: 'sma', name: 'SMA', placement: 'overlay', params: period, lines: [L('v', 'SMA', '#f59e0b')], compute: (c, p) => ({ v: SMA(c, p.period as number) }) },
  { id: 'ema', name: 'EMA', placement: 'overlay', params: period, lines: [L('v', 'EMA', '#38bdf8')], compute: (c, p) => ({ v: EMA(c, p.period as number) }) },
  { id: 'wma', name: 'WMA', placement: 'overlay', params: period, lines: [L('v', 'WMA', '#a78bfa')], compute: (c, p) => ({ v: WMA(c, p.period as number) }) },
  { id: 'vwap', name: 'VWAP', placement: 'overlay', params: [], lines: [L('v', 'VWAP', '#e879f9')], compute: (c) => ({ v: VWAP(c) }) },
  {
    id: 'bb',
    name: 'Bollinger',
    placement: 'overlay',
    params: [P('period', 'period', 20), P('mult', 'mult', 2, 0.1, 10, 0.1)],
    lines: [L('upper', 'Upper', '#60a5fa'), L('middle', 'Basis', '#f59e0b'), L('lower', 'Lower', '#60a5fa')],
    compute: (c, p) => BOLLINGER(c, p.period as number, p.mult as number),
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku',
    placement: 'overlay',
    params: [P('conv', 'conv', 9), P('base', 'base', 26), P('spanb', 'span B', 52), P('disp', 'displacement', 26, 0, 200)],
    lines: [
      L('tenkan', 'Tenkan', '#ef4444'),
      L('kijun', 'Kijun', '#3b82f6'),
      L('spanA', 'Span A', '#22c55e', { offsetParam: { key: 'disp', sign: 1 } }),
      L('spanB', 'Span B', '#f97316', { offsetParam: { key: 'disp', sign: 1 } }),
      L('chikou', 'Chikou', '#a855f7', { offsetParam: { key: 'disp', sign: -1 } }),
    ],
    compute: (c, p) => ICHIMOKU(c, p.conv as number, p.base as number, p.spanb as number),
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    placement: 'overlay',
    params: [P('period', 'period', 10), P('mult', 'mult', 3, 0.1, 20, 0.1)],
    lines: [L('up', 'Up', '#22c55e'), L('down', 'Down', '#ef4444')],
    compute: (c, p) => SUPERTREND(c, p.period as number, p.mult as number),
  },
  {
    id: 'psar',
    name: 'Parabolic SAR',
    placement: 'overlay',
    params: [P('step', 'step', 0.02, 0.001, 1, 0.001), P('max', 'max', 0.2, 0.01, 1, 0.01)],
    lines: [L('v', 'SAR', '#facc15', { kind: 'dots' })],
    compute: (c, p) => ({ v: PSAR(c, p.step as number, p.max as number) }),
  },
  {
    id: 'rsi',
    name: 'RSI',
    placement: 'pane',
    params: period.map((x) => ({ ...x, def: 14 })),
    lines: [L('v', 'RSI', '#a78bfa')],
    range: [0, 100],
    levels: [30, 70],
    compute: (c, p) => ({ v: RSI(c.map((k) => k.close), p.period as number) }),
  },
  {
    id: 'macd',
    name: 'MACD',
    placement: 'pane',
    params: [P('fast', 'fast', 12), P('slow', 'slow', 26), P('signal', 'signal', 9)],
    lines: [L('hist', 'Histogram', '#22c55e', { kind: 'histogram', signed: true }), L('macd', 'MACD', '#38bdf8'), L('signal', 'Signal', '#f59e0b')],
    levels: [0],
    compute: (c, p) => MACD(c, p.fast as number, p.slow as number, p.signal as number),
  },
  {
    id: 'stochrsi',
    name: 'Stoch RSI',
    placement: 'pane',
    params: [P('rsi', 'RSI', 14), P('stoch', 'stoch', 14), P('k', '%K', 3), P('d', '%D', 3)],
    lines: [L('k', '%K', '#38bdf8'), L('d', '%D', '#f59e0b')],
    range: [0, 100],
    levels: [20, 80],
    compute: (c, p) => STOCHRSI(c, p.rsi as number, p.stoch as number, p.k as number, p.d as number),
  },
  { id: 'atr', name: 'ATR', placement: 'pane', params: period.map((x) => ({ ...x, def: 14 })), lines: [L('v', 'ATR', '#fb923c')], compute: (c, p) => ({ v: ATR(c, p.period as number) }) },
  { id: 'obv', name: 'OBV', placement: 'pane', params: [], lines: [L('v', 'OBV', '#2dd4bf')], compute: (c) => ({ v: OBV(c) }) },
  {
    id: 'adx',
    name: 'ADX',
    placement: 'pane',
    params: period.map((x) => ({ ...x, def: 14 })),
    lines: [L('adx', 'ADX', '#f59e0b'), L('plus', '+DI', '#22c55e'), L('minus', '-DI', '#ef4444')],
    compute: (c, p) => ADX(c, p.period as number),
  },
  {
    id: 'volume',
    name: 'Volume',
    placement: 'pane',
    params: [],
    lines: [L('v', 'Volume', '#22c55e', { kind: 'histogram', byCandle: true })],
    compute: (c) => ({ v: c.map((k) => k.volume) }),
  },
];

export const BY_ID: Record<string, IndicatorDef> = Object.fromEntries(INDICATORS.map((d) => [d.id, d]));

export interface IndicatorInstance {
  uid: string;
  id: string;
  params: Record<string, number>;
  colors: string[];
  width: number;
}

export function defaultParams(def: IndicatorDef): Record<string, number> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.def]));
}

export function newInstance(id: string, uid: string): IndicatorInstance {
  const def = BY_ID[id] as IndicatorDef;
  return { uid, id, params: defaultParams(def), colors: def.lines.map((l) => l.color), width: 2 };
}

/** Clamps untrusted parameter values into each definition's allowed range. */
export function sanitizeParams(def: IndicatorDef, raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) {
    const v = Number(raw[p.key]);
    out[p.key] = Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, v)) : p.def;
  }
  return out;
}
