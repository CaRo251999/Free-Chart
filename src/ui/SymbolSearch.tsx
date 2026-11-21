import { useEffect, useMemo, useState } from 'preact/hooks';
import { Modal } from './Modal';
import { t } from '../i18n';
import { loadPairIndex, searchPairs, type PairEntry } from '../data/symbols';
import { ADAPTERS } from '../exchanges/registry';
import type { Pair } from '../exchanges/symbols';

interface Props {
  onPick: (pair: Pair) => void;
  onClose: () => void;
  title?: string;
}

/** Pair search across every supported exchange. */
export function SymbolSearch({ onPick, onClose, title }: Props) {
  const [index, setIndex] = useState<PairEntry[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    void loadPairIndex().then(setIndex);
  }, []);
  const results = useMemo(() => (index ? searchPairs(index, q) : []), [index, q]);

  return (
    <Modal title={title ?? t('search')} onClose={onClose}>
      <input
        class="input"
        autoFocus
        value={q}
        placeholder={t('searchPlaceholder')}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        aria-label={t('search')}
      />
      <ul class="result-list">
        {!index && <li class="muted">{t('searchLoading')}</li>}
        {index && results.length === 0 && <li class="muted">{t('searchEmpty')}</li>}
        {results.map((r) => (
          <li key={`${r.base}/${r.quote}`}>
            <button
              class="result"
              onClick={() => {
                onPick({ base: r.base, quote: r.quote });
                onClose();
              }}
            >
              <strong>{r.base}</strong>
              <span class="muted">/{r.quote}</span>
              <span class="badges">
                {r.exchanges.map((e) => (
                  <span class="chip" key={e}>{ADAPTERS[e].name}</span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
