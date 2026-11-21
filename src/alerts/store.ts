import { effect, signal } from '@preact/signals';
import { load, save } from '../data/storage';
import { uid } from '../watchlist/store';
import type { Preference } from '../exchanges/registry';
import { ALL_IDS } from '../exchanges/registry';

export interface Alert {
  id: string;
  base: string;
  quote: string;
  pref?: Preference;
  price: number;
  dir: 'above' | 'below';
  created: number;
  /** Epoch ms when it fired; undefined while armed. */
  triggered?: number;
}

const ASSET = /^[A-Z0-9.\-_]{1,20}$/;

export function sanitizeAlerts(raw: unknown): Alert[] {
  if (!Array.isArray(raw)) return [];
  const out: Alert[] = [];
  for (const r of raw as Partial<Alert>[]) {
    if (!r || typeof r !== 'object') continue;
    const base = String(r.base ?? '').toUpperCase();
    const quote = String(r.quote ?? '').toUpperCase();
    const price = Number(r.price);
    if (!ASSET.test(base) || !ASSET.test(quote) || !Number.isFinite(price) || price <= 0) continue;
    if (r.dir !== 'above' && r.dir !== 'below') continue;
    out.push({
      id: typeof r.id === 'string' ? r.id : uid(),
      base, quote, price, dir: r.dir,
      pref: r.pref && (ALL_IDS as string[]).includes(r.pref) ? r.pref : undefined,
      created: Number(r.created) || Date.now(),
      triggered: r.triggered ? Number(r.triggered) : undefined,
    });
  }
  return out;
}

export const alerts = signal<Alert[]>(sanitizeAlerts(load('alerts', [])));
effect(() => void save('alerts', alerts.value));

export const activeAlertCount = () => alerts.value.filter((a) => !a.triggered).length;

export function addAlert(a: Omit<Alert, 'id' | 'created' | 'triggered'>) {
  alerts.value = [...alerts.value, { ...a, id: uid(), created: Date.now() }];
}
export function removeAlert(id: string) {
  alerts.value = alerts.value.filter((a) => a.id !== id);
}
export function rearmAlert(id: string) {
  alerts.value = alerts.value.map((a) => (a.id === id ? { ...a, triggered: undefined } : a));
}
export function markTriggered(id: string) {
  alerts.value = alerts.value.map((a) => (a.id === id && !a.triggered ? { ...a, triggered: Date.now() } : a));
}

/** An alert fires once the live price reaches or crosses its level. */
export function shouldTrigger(a: Pick<Alert, 'dir' | 'price' | 'triggered'>, price: number): boolean {
  if (a.triggered || !Number.isFinite(price)) return false;
  return a.dir === 'above' ? price >= a.price : price <= a.price;
}
