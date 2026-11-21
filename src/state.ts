import { signal, effect } from '@preact/signals';
import { load, save } from './data/storage';
import type { Interval } from './exchanges/types';
import type { Preference } from './exchanges/registry';
import { pairKey, type Pair } from './exchanges/symbols';

export type Theme = 'dark' | 'light';
export type ChartType = 'candles' | 'line' | 'area' | 'heikin';
export type LayoutKind = 1 | 2 | 4;

export const theme = signal<Theme>(load<Theme>('theme', 'dark'));
export const interval = signal<Interval>(load<Interval>('interval', '1h'));
export const chartType = signal<ChartType>(load<ChartType>('chartType', 'candles'));
export const pair = signal<Pair>(load<Pair>('pair', { base: 'BTC', quote: 'USD' }));
/** Exchange chosen by the user per pair ("BTC/USD" -> "kraken"); missing = automatic. */
export const prefByPair = signal<Record<string, Preference>>(load('prefByPair', {}));
export const layout = signal<LayoutKind>(load<LayoutKind>('layout', 1));
export const magnet = signal<boolean>(load('magnet', true));
export const sidebarOpen = signal<boolean>(load('sidebarOpen', true));
/** Pairs shown in extra panes of multi-chart layouts. */
export const extraPairs = signal<Pair[]>(load('extraPairs', [
  { base: 'ETH', quote: 'USD' },
  { base: 'SOL', quote: 'USD' },
  { base: 'XRP', quote: 'USD' },
]));
export const route = signal<string>(parseRoute());

function parseRoute(): string {
  const h = location.hash.replace(/^#\/?/, '');
  return h.split(/[?&]/)[0] ?? '';
}
window.addEventListener('hashchange', () => (route.value = parseRoute()));

export const preferenceFor = (p: Pair): Preference => prefByPair.value[pairKey(p)] ?? 'auto';

export function setPreference(p: Pair, pref: Preference) {
  const next = { ...prefByPair.value };
  if (pref === 'auto') delete next[pairKey(p)];
  else next[pairKey(p)] = pref;
  prefByPair.value = next;
}

export function selectPair(p: Pair, pref?: Preference) {
  pair.value = p;
  if (pref) setPreference(p, pref);
}

// Persist everything on change; apply the theme to <html>.
effect(() => {
  save('theme', theme.value);
  document.documentElement.dataset.theme = theme.value;
});
effect(() => void save('interval', interval.value));
effect(() => void save('chartType', chartType.value));
effect(() => void save('pair', pair.value));
effect(() => void save('prefByPair', prefByPair.value));
effect(() => void save('layout', layout.value));
effect(() => void save('magnet', magnet.value));
effect(() => void save('sidebarOpen', sidebarOpen.value));
effect(() => void save('extraPairs', extraPairs.value));
