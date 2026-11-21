import { effect, signal } from '@preact/signals';
import { load, save } from '../data/storage';
import { BY_ID, newInstance, sanitizeParams, type IndicatorInstance } from './registry';
import { uid } from '../watchlist/store';

export interface IndicatorTemplate {
  name: string;
  items: Omit<IndicatorInstance, 'uid'>[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Drops unknown ids and clamps values so stored/imported data can never break the chart. */
export function sanitizeInstances(raw: unknown): IndicatorInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: IndicatorInstance[] = [];
  for (const r of raw as Partial<IndicatorInstance>[]) {
    const def = r && typeof r.id === 'string' ? BY_ID[r.id] : undefined;
    if (!def) continue;
    const base = newInstance(def.id, typeof r.uid === 'string' ? r.uid : uid());
    base.params = sanitizeParams(def, (r.params ?? {}) as Record<string, unknown>);
    base.colors = def.lines.map((l, i) => (typeof r.colors?.[i] === 'string' && HEX.test(r.colors[i] as string) ? (r.colors[i] as string) : l.color));
    const w = Number(r.width);
    base.width = Number.isFinite(w) ? Math.min(4, Math.max(1, Math.round(w))) : 2;
    out.push(base);
  }
  return out;
}

export const indicators = signal<IndicatorInstance[]>(sanitizeInstances(load('indicators', [])));
export const templates = signal<IndicatorTemplate[]>(
  load<IndicatorTemplate[]>('indTemplates', []).filter((t) => t && typeof t.name === 'string' && Array.isArray(t.items)),
);

effect(() => void save('indicators', indicators.value));
effect(() => void save('indTemplates', templates.value));

export function addIndicator(id: string) {
  if (!BY_ID[id]) return;
  indicators.value = [...indicators.value, newInstance(id, uid())];
}

export function updateIndicator(id: string, patch: Partial<Omit<IndicatorInstance, 'uid' | 'id'>>) {
  indicators.value = indicators.value.map((i) => (i.uid === id ? sanitizeInstances([{ ...i, ...patch }])[0] ?? i : i));
}

export function removeIndicator(id: string) {
  indicators.value = indicators.value.filter((i) => i.uid !== id);
}

export function saveTemplate(name: string) {
  const n = name.trim().slice(0, 60);
  if (!n) return;
  const items = indicators.value.map(({ id, params, colors, width }) => ({ id, params, colors, width }));
  templates.value = [...templates.value.filter((t) => t.name !== n), { name: n, items }];
}

export function applyTemplate(name: string, replace = true) {
  const t = templates.value.find((x) => x.name === name);
  if (!t) return;
  const fresh = sanitizeInstances(t.items.map((i) => ({ ...i, uid: uid() })));
  indicators.value = replace ? fresh : [...indicators.value, ...fresh];
}

export function deleteTemplate(name: string) {
  templates.value = templates.value.filter((t) => t.name !== name);
}
