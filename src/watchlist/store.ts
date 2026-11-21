import { signal } from '@preact/signals';
import { effect } from '@preact/signals';
import { load, save } from '../data/storage';
import type { Preference } from '../exchanges/registry';

export const FLAGS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const;
export type FlagColor = (typeof FLAGS)[number];

export interface WItem {
  base: string;
  quote: string;
  pref?: Preference;
  flag?: FlagColor;
  note?: string;
}
export interface WList {
  id: string;
  name: string;
  items: WItem[];
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const itemKey = (i: { base: string; quote: string }) => `${i.base}/${i.quote}`;

/** Pure: moves an element, returning a new array. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as T);
  return next;
}

const defaultList = (): WList => ({
  id: uid(),
  name: 'Principal',
  items: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].map((base) => ({ base, quote: 'USD' })),
});

const initial = load<WList[]>('watchlists', []);
export const lists = signal<WList[]>(initial.length ? initial : [defaultList()]);
export const activeId = signal<string>(load('activeList', (lists.value[0] as WList).id));

effect(() => void save('watchlists', lists.value));
effect(() => void save('activeList', activeId.value));

export const activeList = (): WList => lists.value.find((l) => l.id === activeId.value) ?? (lists.value[0] as WList);

function update(id: string, fn: (l: WList) => WList) {
  lists.value = lists.value.map((l) => (l.id === id ? fn(l) : l));
}

export function createList(name: string, items: WItem[] = []): WList {
  const l: WList = { id: uid(), name: name.trim() || 'Lista', items };
  lists.value = [...lists.value, l];
  activeId.value = l.id;
  return l;
}

export function renameList(id: string, name: string) {
  update(id, (l) => ({ ...l, name: name.trim() || l.name }));
}

export function deleteList(id: string) {
  const rest = lists.value.filter((l) => l.id !== id);
  lists.value = rest.length ? rest : [{ id: uid(), name: 'Principal', items: [] }];
  if (activeId.value === id) activeId.value = (lists.value[0] as WList).id;
}

export function addItem(id: string, item: WItem) {
  update(id, (l) => (l.items.some((i) => itemKey(i) === itemKey(item)) ? l : { ...l, items: [...l.items, item] }));
}

export function removeItem(id: string, key: string) {
  update(id, (l) => ({ ...l, items: l.items.filter((i) => itemKey(i) !== key) }));
}

export function patchItem(id: string, key: string, patch: Partial<WItem>) {
  update(id, (l) => ({ ...l, items: l.items.map((i) => (itemKey(i) === key ? { ...i, ...patch } : i)) }));
}

export function reorderItems(id: string, from: number, to: number) {
  update(id, (l) => ({ ...l, items: moveItem(l.items, from, to) }));
}

/** Adds lists coming from import/share, giving them fresh ids. */
export function importLists(incoming: { name: string; items: WItem[] }[]): number {
  for (const l of incoming) lists.value = [...lists.value, { id: uid(), name: l.name, items: l.items }];
  const last = lists.value[lists.value.length - 1];
  if (incoming.length && last) activeId.value = last.id;
  return incoming.length;
}
