export type DrawingKind = 'trend' | 'ray' | 'hline' | 'vline' | 'channel' | 'rect' | 'fib' | 'text' | 'arrow' | 'ruler' | 'long' | 'short';
export type Tool = 'cursor' | DrawingKind;

export interface DPoint {
  /** UTC seconds (may lie beyond the first/last candle). */
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  kind: DrawingKind;
  points: DPoint[];
  color: string;
  width: number;
  text?: string;
}

/** Clicks needed to place each tool. Long/short add their stop automatically after two. */
export const CLICKS: Record<DrawingKind, number> = {
  trend: 2, ray: 2, hline: 1, vline: 1, channel: 3, rect: 2, fib: 2, text: 1, arrow: 2, ruler: 2, long: 2, short: 2,
};

export const TOOL_ORDER: DrawingKind[] = ['trend', 'ray', 'hline', 'vline', 'channel', 'rect', 'fib', 'text', 'arrow', 'ruler', 'long', 'short'];

export const TOOL_ICON: Record<DrawingKind, string> = {
  trend: '╱', ray: '↗', hline: '─', vline: '│', channel: '⫽', rect: '▭', fib: '≡', text: 'T', arrow: '➚', ruler: '⟷', long: '▲', short: '▼',
};

export const DEFAULT_COLOR: Record<DrawingKind, string> = {
  trend: '#38bdf8', ray: '#38bdf8', hline: '#f59e0b', vline: '#f59e0b', channel: '#a78bfa', rect: '#22d3ee',
  fib: '#f97316', text: '#e2e8f0', arrow: '#f43f5e', ruler: '#94a3b8', long: '#22c55e', short: '#ef4444',
};

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
