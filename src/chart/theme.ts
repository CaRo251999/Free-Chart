import type { Theme } from '../state';

export interface ChartColors {
  bg: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  upVol: string;
  downVol: string;
  line: string;
  crosshair: string;
}

export const COLORS: Record<Theme, ChartColors> = {
  dark: {
    bg: '#0f172a', text: '#cbd5e1', grid: '#1e293b', border: '#334155',
    up: '#22c55e', down: '#ef4444', upVol: 'rgba(34,197,94,0.35)', downVol: 'rgba(239,68,68,0.35)',
    line: '#22d3ee', crosshair: '#94a3b8',
  },
  light: {
    bg: '#ffffff', text: '#334155', grid: '#e2e8f0', border: '#cbd5e1',
    up: '#15803d', down: '#dc2626', upVol: 'rgba(21,128,61,0.3)', downVol: 'rgba(220,38,38,0.3)',
    line: '#0e7490', crosshair: '#64748b',
  },
};
