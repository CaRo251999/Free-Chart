import { dumpAll, restoreAll } from './storage';

export const BACKUP_APP = 'free-chart';
const MAX_BYTES = 8 * 1024 * 1024;
const KEY_OK = /^[A-Za-z0-9:_/.-]{1,120}$/;

export interface Backup {
  app: typeof BACKUP_APP;
  version: 1;
  created: string;
  data: Record<string, unknown>;
}

/** Everything the app stores (watchlists, drawings, indicators, templates, alerts, settings). */
export function buildBackup(data: Record<string, unknown> = dumpAll(), now = new Date()): Backup {
  return { app: BACKUP_APP, version: 1, created: now.toISOString(), data };
}

/** Parses and validates a backup file; throws on anything unexpected. */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BYTES) throw new Error('too large');
  const raw = JSON.parse(text) as Partial<Backup>;
  if (!raw || raw.app !== BACKUP_APP || raw.version !== 1 || typeof raw.data !== 'object' || raw.data === null || Array.isArray(raw.data)) {
    throw new Error('not a Free Chart backup');
  }
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.data)) {
    if (KEY_OK.test(k)) data[k] = v;
  }
  if (!Object.keys(data).length) throw new Error('empty backup');
  return { app: BACKUP_APP, version: 1, created: String(raw.created ?? ''), data };
}

export function restoreBackup(b: Backup) {
  restoreAll(b.data);
}
