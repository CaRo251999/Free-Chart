import { useEffect, useState } from 'preact/hooks';
import { route } from '../state';
import { t } from '../i18n';
import { decodeList, shareCodeFromHash } from '../watchlist/shareLink';
import { importLists, type WItem } from '../watchlist/store';
import { Modal } from './Modal';
import { toast } from './toast';

/** Detects #/s=<code> links and asks before importing the shared list. */
export function ShareImport() {
  const [shared, setShared] = useState<{ name: string; items: WItem[] } | null>(null);
  const r = route.value;

  useEffect(() => {
    const code = shareCodeFromHash();
    if (!code) return;
    decodeList(code)
      .then(setShared)
      .catch(() => {
        toast(t('importFail'));
        location.hash = '#/';
      });
  }, [r]);

  if (!shared) return null;
  const close = () => {
    setShared(null);
    location.hash = '#/';
  };
  return (
    <Modal title={t('sharedListTitle')} onClose={close}>
      <p>{t('sharedListAsk', { name: shared.name, n: shared.items.length })}</p>
      <div class="row end">
        <button class="btn" onClick={close}>{t('cancel')}</button>
        <button
          class="btn primary"
          onClick={() => {
            importLists([shared]);
            toast(t('importDone'));
            close();
          }}
        >
          {t('accept')}
        </button>
      </div>
    </Modal>
  );
}
