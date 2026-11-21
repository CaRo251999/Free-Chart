import { effect } from '@preact/signals';
import { alerts, markTriggered, shouldTrigger, type Alert } from './store';
import { fireAlert } from './notify';
import { fetchTicker, subscribeLive } from '../exchanges/router';
import { fmtPrice } from '../ui/format';
import { t } from '../i18n';

interface Watch {
  unsub: () => void;
  cancelled: boolean;
}

const watches = new Map<string, Watch>();
const keyOf = (a: Pick<Alert, 'base' | 'quote' | 'pref'>) => `${a.base}/${a.quote}|${a.pref ?? 'auto'}`;

function check(key: string, price: number) {
  for (const a of alerts.peek()) {
    if (keyOf(a) !== key || !shouldTrigger(a, price)) continue;
    markTriggered(a.id);
    fireAlert(t('alertTriggered', { pair: `${a.base}/${a.quote}`, price: fmtPrice(a.price) }));
  }
}

async function start(key: string, a: Alert) {
  const w: Watch = { unsub: () => {}, cancelled: false };
  watches.set(key, w);
  try {
    // Resolve which exchange/symbol serves this pair, then follow its live stream.
    const r = await fetchTicker({ base: a.base, quote: a.quote }, a.pref ?? 'auto');
    if (w.cancelled) return;
    check(key, r.data.last);
    w.unsub = subscribeLive(r.exchange, r.symbol, '1m', (c) => check(key, c.close));
  } catch {
    if (!w.cancelled) {
      // Try again later (offline, rate limit, ...).
      setTimeout(() => {
        if (watches.get(key) === w) {
          watches.delete(key);
          reconcile();
        }
      }, 30000);
    }
  }
}

/** Keeps exactly one live subscription per pair that still has an armed alert. */
export function reconcile() {
  const armed = new Map<string, Alert>();
  for (const a of alerts.peek()) if (!a.triggered) armed.set(keyOf(a), a);
  for (const [key, w] of watches) {
    if (!armed.has(key)) {
      w.cancelled = true;
      w.unsub();
      watches.delete(key);
    }
  }
  for (const [key, a] of armed) if (!watches.has(key)) void start(key, a);
}

/** Starts the engine; alerts only run while this tab is open (there is no server). */
export function startAlertEngine(): () => void {
  return effect(() => {
    void alerts.value;
    reconcile();
  });
}
