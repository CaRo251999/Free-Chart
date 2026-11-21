import { FLAGS, type FlagColor, type WItem, type WList } from './store';
import type { Preference } from '../exchanges/registry';
import { ALL_IDS } from '../exchanges/registry';

const ASSET = /^[A-Z0-9.\-_]{1,20}$/;

/** Validates untrusted input (files, share links) into a safe item, or null. */
export function sanitizeItem(raw: unknown): WItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = String(r.base ?? '').toUpperCase();
  const quote = String(r.quote ?? '').toUpperCase();
  if (!ASSET.test(base) || !ASSET.test(quote)) return null;
  const item: WItem = { base, quote };
  if (typeof r.pref === 'string' && (ALL_IDS as string[]).includes(r.pref)) item.pref = r.pref as Preference;
  if (typeof r.flag === 'string' && (FLAGS as readonly string[]).includes(r.flag)) item.flag = r.flag as FlagColor;
  if (typeof r.note === 'string' && r.note.trim()) item.note = r.note.slice(0, 500);
  return item;
}

export function sanitizeList(raw: unknown): { name: string; items: WItem[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return null;
  const seen = new Set<string>();
  const items: WItem[] = [];
  for (const x of r.items) {
    const it = sanitizeItem(x);
    if (it && !seen.has(`${it.base}/${it.quote}`)) {
      seen.add(`${it.base}/${it.quote}`);
      items.push(it);
    }
  }
  return { name: String(r.name ?? 'Lista').slice(0, 60) || 'Lista', items };
}

export function exportJson(lists: WList[]): string {
  return JSON.stringify({ app: 'free-chart', version: 1, lists: lists.map(({ name, items }) => ({ name, items })) }, null, 2);
}

export function parseJson(text: string): { name: string; items: WItem[] }[] {
  const data = JSON.parse(text) as { lists?: unknown[] } | unknown[];
  const arr = Array.isArray(data) ? data : data.lists;
  if (!Array.isArray(arr)) throw new Error('invalid');
  const out = arr.map(sanitizeList).filter((x): x is { name: string; items: WItem[] } => x !== null);
  if (!out.length) throw new Error('empty');
  return out;
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function exportCsv(list: WList): string {
  const rows = ['symbol,exchange,flag,note'];
  for (const i of list.items) rows.push([`${i.base}/${i.quote}`, i.pref ?? 'auto', i.flag ?? '', i.note ?? ''].map(csvCell).join(','));
  return rows.join('\n') + '\n';
}

/** RFC-4180-ish CSV parser (quoted cells, escaped quotes, CRLF). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export function parseCsv(text: string, name = 'Importada'): { name: string; items: WItem[] } {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsvRows(clean);
  const head = (rows[0] ?? []).map((c) => c.trim().toLowerCase());
  const hasHeader = head.includes('symbol');
  const col = (n: string, fallback: number) => (hasHeader ? head.indexOf(n) : fallback);
  const [iS, iE, iF, iN] = [col('symbol', 0), col('exchange', 1), col('flag', 2), col('note', 3)];
  const items: WItem[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(hasHeader ? 1 : 0)) {
    const sym = (r[iS] ?? '').trim().toUpperCase().replace(/[-_]/g, '/');
    const [base, quote] = sym.split('/');
    const it = sanitizeItem({ base, quote: quote ?? 'USD', pref: (r[iE] ?? '').trim().toLowerCase(), flag: (r[iF] ?? '').trim().toLowerCase(), note: r[iN] });
    if (it && !seen.has(`${it.base}/${it.quote}`)) {
      seen.add(`${it.base}/${it.quote}`);
      items.push(it);
    }
  }
  if (!items.length) throw new Error('empty');
  return { name, items };
}
