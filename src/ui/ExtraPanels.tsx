import { useRef, useState } from 'preact/hooks';
import { Modal } from './Modal';
import { SymbolSearch } from './SymbolSearch';
import { toast } from './toast';
import { fmtPrice } from './format';
import { t } from '../i18n';
import { alerts, addAlert, rearmAlert, removeAlert } from '../alerts/store';
import { ensurePermission, notificationsSupported } from '../alerts/notify';
import { buildBackup, parseBackup, restoreBackup } from '../data/backup';
import { pair } from '../state';
import { pairKey, type Pair } from '../exchanges/symbols';
import { tickers } from '../watchlist/tickers';
import { fetchTicker } from '../exchanges/router';
import { SHORTCUTS } from './shortcuts';

export function AlertsPanel({ onClose }: { onClose: () => void }) {
  const [target, setTarget] = useState<Pair>(pair.value);
  const [dir, setDir] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [picking, setPicking] = useState(false);
  const [denied, setDenied] = useState(notificationsSupported() && Notification.permission === 'denied');

  const prefill = async (p: Pair) => {
    const cached = tickers.value[pairKey(p)]?.ticker.last;
    if (cached) return setPrice(String(cached));
    try {
      setPrice(String((await fetchTicker(p, 'auto')).data.last));
    } catch {
      /* leave empty */
    }
  };

  const create = async (e: Event) => {
    e.preventDefault();
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return;
    const perm = await ensurePermission(); // needs the click gesture
    setDenied(perm === 'denied');
    addAlert({ base: target.base, quote: target.quote, price: value, dir });
    toast(t('createAlert'));
  };

  return (
    <Modal title={t('alerts')} onClose={onClose}>
      <p class="muted">{t('alertsNote')}</p>
      {denied && <p class="chip chip-warn">{t('notifyDenied')}</p>}
      <form class="alert-form" onSubmit={create}>
        <button type="button" class="btn" onClick={() => setPicking(true)} aria-label={t('pickPair')}>{pairKey(target)}</button>
        <select class="select" value={dir} aria-label={t('alerts')} onChange={(e) => setDir((e.target as HTMLSelectElement).value as 'above' | 'below')}>
          <option value="above">{t('alertAbove')}</option>
          <option value="below">{t('alertBelow')}</option>
        </select>
        <input class="input" type="number" step="any" min="0" value={price} placeholder={t('alertPrice')} aria-label={t('alertPrice')} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} />
        <button type="button" class="btn" onClick={() => void prefill(target)} title={t('currentPrice')}>⟳</button>
        <button class="btn primary" type="submit" disabled={!price}>{t('createAlert')}</button>
      </form>
      <ul class="alert-list">
        {alerts.value.length === 0 && <li class="muted">{t('noAlerts')}</li>}
        {alerts.value.map((a) => (
          <li key={a.id} class="row">
            <strong>{a.base}/{a.quote}</strong>
            <span>{a.dir === 'above' ? '≥' : '≤'} {fmtPrice(a.price)}</span>
            <span class={`chip ${a.triggered ? 'chip-warn' : 'chip-ok'}`}>{a.triggered ? `${t('alertFired')} ${new Date(a.triggered).toLocaleTimeString()}` : t('alertArmed')}</span>
            <span class="grow" />
            {a.triggered && <button class="btn" onClick={() => rearmAlert(a.id)}>{t('rearm')}</button>}
            <button class="btn icon" aria-label={t('remove')} onClick={() => removeAlert(a.id)}>✕</button>
          </li>
        ))}
      </ul>
      {picking && <SymbolSearch onClose={() => setPicking(false)} onPick={(p) => { setTarget(p); void prefill(p); }} />}
    </Modal>
  );
}

function downloadText(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function BackupPanel({ onClose }: { onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const restore = async (f: File) => {
    try {
      const backup = parseBackup(await f.text());
      if (!confirm(t('restoreConfirm'))) return;
      restoreBackup(backup);
      toast(t('restoreDone'));
      setTimeout(() => location.reload(), 600); // rehydrate every store from the restored data
    } catch {
      toast(t('restoreFail'));
    }
  };
  return (
    <Modal title={t('backup')} onClose={onClose}>
      <p>{t('backupHelp')}</p>
      <div class="row">
        <button class="btn primary" onClick={() => downloadText(`free-chart-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(), null, 2))}>{t('exportBackup')}</button>
        <button class="btn" onClick={() => file.current?.click()}>{t('restoreBackup')}</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) void restore(f);
          (e.target as HTMLInputElement).value = '';
        }} />
      </div>
    </Modal>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={t('shortcuts')} onClose={onClose}>
      <table class="table">
        <tbody>
          {SHORTCUTS.map(([keys, label]) => (
            <tr key={label}>
              <td><kbd>{keys}</kbd></td>
              <td>{t(label)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
