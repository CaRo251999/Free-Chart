import { signal } from '@preact/signals';
import { es, type Key } from './es';
import { en } from './en';
import { load, save } from '../data/storage';

export type Lang = 'es' | 'en';
const dicts = { es, en };

const initial = (): Lang => {
  const stored = load<Lang | null>('lang', null);
  if (stored === 'es' || stored === 'en') return stored;
  return 'es'; // default language per spec
};

export const lang = signal<Lang>(initial());

export function setLang(l: Lang) {
  lang.value = l;
  save('lang', l);
  document.documentElement.lang = l;
}

/** Translate; reading `lang.value` inside components makes them re-render on change. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = dicts[lang.value][key] ?? es[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
