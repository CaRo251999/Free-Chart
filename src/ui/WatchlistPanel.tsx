import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { pair, selectPair } from '../state';
import {
  FLAGS, activeId, activeList, addItem, createList, deleteList, importLists, itemKey, lists, patchItem,
  removeItem, renameList, reorderItems, type FlagColor, type WItem,
} from '../watchlist/store';
import { refreshTickers, tickers } from '../watchlist/tickers';
import { exportCsv, exportJson, parseCsv, parseJson } from '../watchlist/importExport';
import { buildShareUrl } from '../watchlist/shareLink';
import { fmtCompact, fmtPct, fmtPrice } from './format';
import { SymbolSearch } from './SymbolSearch';
import { Modal } from './Modal';
import { toast } from './toast';

type SortKey = 'manual' | 'symbol' | 'price' | 'change' | 'volume';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function WatchlistPanel() {
  const list = activeList();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'manual', dir: 1 });
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [naming, setNaming] = useState<null | { mode: 'new' | 'rename'; value: string }>(null);
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Poll tickers while the panel is mounted and the tab is visible.
  const itemsKey = list.items.map(itemKey).join('|');
  useEffect(() => {
    const run = () => !document.hidden && void refreshTickers(list.items);
    run();
    const id = setInterval(run, 20000);
    return () => clearInterval(id);
  }, [itemsKey, list.id]);

  const rows = useMemo(() => {
    const data = tickers.value;
    const arr = list.items.map((item, index) => ({ item, index, e: data[itemKey(item)] }));
    if (sort.key === 'manual') return arr;
    const val = (r: (typeof arr)[number]) =>
      sort.key === 'symbol' ? itemKey(r.item) : sort.key === 'price' ? r.e?.ticker.last : sort.key === 'change' ? r.e?.ticker.changePct : r.e?.quoteVolume;
    return arr.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [list, sort, tickers.value]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? (s.dir === 1 ? { key, dir: -1 } : { key: 'manual', dir: 1 }) : { key, dir: key === 'symbol' ? 1 : -1 }));
  const arrow = (k: SortKey) => (sort.key === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  const onImportFile = async (f: File) => {
    try {
      const text = await f.text();
      const parsed = f.name.toLowerCase().endsWith('.csv') ? [parseCsv(text, f.name.replace(/\.csv$/i, ''))] : parseJson(text);
      importLists(parsed);
      toast(t('importDone'));
    } catch {
      toast(t('importFail'));
    }
  };

  // Drag & drop with Pointer Events (mouse + touch).
  const startDrag = (e: PointerEvent, from: number) => {
    if (sort.key !== 'manual') return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from, over: from });
  };
  const moveDrag = (e: PointerEvent) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-index]');
    const over = el ? Number((el as HTMLElement).dataset.index) : drag.over;
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const endDrag = () => {
    if (drag && drag.from !== drag.over) reorderItems(list.id, drag.from, drag.over);
    setDrag(null);
  };

  const share = async () => {
    const url = await buildShareUrl(list.name, list.items);
    try {
      await navigator.clipboard.writeText(url);
      toast(t('linkCopied'));
    } catch {
      window.prompt(t('shareLink'), url);
    }
  };

  return (
    <aside class="sidebar" aria-label={t('watchlist')}>
      <div class="wl-head">
        <select class="select wl-select" aria-label={t('watchlist')} value={list.id} onChange={(e) => (activeId.value = (e.target as HTMLSelectElement).value)}>
          {lists.value.map((l) => (
            <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>
          ))}
        </select>
        <button class="btn icon" title={t('newList')} aria-label={t('newList')} onClick={() => setNaming({ mode: 'new', value: '' })}>＋</button>
        <button class="btn icon" title={t('menu')} aria-label={t('menu')} aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
      </div>
      {menu && (
        <div class="wl-menu" role="menu">
          <button class="btn" role="menuitem" onClick={() => { setNaming({ mode: 'rename', value: list.name }); setMenu(false); }}>{t('renameList')}</button>
          <button class="btn" role="menuitem" onClick={() => { if (confirm(t('confirmDelete', { name: list.name }))) deleteList(list.id); setMenu(false); }}>{t('deleteList')}</button>
          <button class="btn" role="menuitem" onClick={() => { fileRef.current?.click(); setMenu(false); }}>{t('importList')}</button>
          <button class="btn" role="menuitem" onClick={() => { download('free-chart-lists.json', exportJson(lists.value), 'application/json'); setMenu(false); }}>{t('exportJson')}</button>
          <button class="btn" role="menuitem" onClick={() => { download(`${list.name}.csv`, exportCsv(list), 'text/csv'); setMenu(false); }}>{t('exportCsv')}</button>
          <button class="btn" role="menuitem" onClick={() => { void share(); setMenu(false); }}>{t('shareLink')}</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) void onImportFile(f);
        (e.target as HTMLInputElement).value = '';
      }} />
      <button class="btn add-btn" onClick={() => setAdding(true)}>＋ {t('addSymbol')}</button>

      <div class="wl-table" role="table">
        <div class="wl-row wl-th" role="row">
          <span />
          <button class="th" onClick={() => toggleSort('symbol')}>{t('symbol')}{arrow('symbol')}</button>
          <button class="th num" onClick={() => toggleSort('price')}>{t('price')}{arrow('price')}</button>
          <button class="th num" onClick={() => toggleSort('change')}>{t('change24h')}{arrow('change')}</button>
          <button class="th num hide-narrow" onClick={() => toggleSort('volume')}>{t('volume24h')}{arrow('volume')}</button>
          <span />
        </div>
        {rows.length === 0 && <p class="muted pad">{t('emptyList')}</p>}
        {rows.map(({ item, index, e }) => {
          const key = itemKey(item);
          const active = key === `${pair.value.base}/${pair.value.quote}`;
          const ch = e?.ticker.changePct;
          return (
            <div key={key}>
              <div
                class={`wl-row${active ? ' active' : ''}${drag?.over === index && drag.from !== index ? ' drop' : ''}${drag?.from === index ? ' dragging' : ''}`}
                data-index={index}
                role="row"
              >
                <span
                  class="handle"
                  title="⠿"
                  style={{ visibility: sort.key === 'manual' ? 'visible' : 'hidden' }}
                  onPointerDown={(ev) => startDrag(ev, index)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={() => setDrag(null)}
                  aria-hidden="true"
                >⠿</span>
                <button class="sym" onClick={() => selectPair({ base: item.base, quote: item.quote }, item.pref)} title={item.note ?? ''}>
                  {item.flag && <i class={`flag f-${item.flag}`} aria-label={item.flag} />}
                  <strong>{item.base}</strong><span class="muted">/{item.quote}</span>
                </button>
                <span class="num">{fmtPrice(e?.ticker.last)}</span>
                <span class={`num ${ch === undefined ? '' : ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ch)}</span>
                <span class="num muted hide-narrow">{fmtCompact(e?.quoteVolume)}</span>
                <span class="row-actions">
                  <button class="mini" aria-label={t('flag')} title={t('flag')} onClick={() => setFlagFor(flagFor === key ? null : key)}>⚑</button>
                  <button class="mini" aria-label={t('note')} title={t('note')} onClick={() => setNoteFor(noteFor === key ? null : key)}>✎</button>
                  <button class="mini" aria-label={t('removeSymbol')} title={t('removeSymbol')} onClick={() => removeItem(list.id, key)}>✕</button>
                </span>
              </div>
              {flagFor === key && (
                <div class="flag-picker">
                  <button class="swatch none" aria-label={t('noFlag')} onClick={() => { patchItem(list.id, key, { flag: undefined }); setFlagFor(null); }}>∅</button>
                  {FLAGS.map((f: FlagColor) => (
                    <button key={f} class={`swatch f-${f}`} aria-label={f} onClick={() => { patchItem(list.id, key, { flag: f }); setFlagFor(null); }} />
                  ))}
                </div>
              )}
              {noteFor === key && (
                <NoteEditor item={item} onSave={(note) => { patchItem(list.id, key, { note: note || undefined }); setNoteFor(null); }} />
              )}
              {item.note && noteFor !== key && <div class="wl-note muted">{item.note}</div>}
            </div>
          );
        })}
      </div>

      {adding && <SymbolSearch title={t('addSymbol')} onClose={() => setAdding(false)} onPick={(p) => addItem(list.id, { base: p.base, quote: p.quote })} />}
      {naming && (
        <Modal title={naming.mode === 'new' ? t('newList') : t('renameList')} onClose={() => setNaming(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (naming.mode === 'new') createList(naming.value);
              else renameList(list.id, naming.value);
              setNaming(null);
            }}
          >
            <input class="input" autoFocus maxLength={60} placeholder={t('listName')} aria-label={t('listName')} value={naming.value} onInput={(e) => setNaming({ ...naming, value: (e.target as HTMLInputElement).value })} />
            <div class="row end"><button class="btn primary" type="submit">{t('accept')}</button></div>
          </form>
        </Modal>
      )}
    </aside>
  );
}

function NoteEditor({ item, onSave }: { item: WItem; onSave: (note: string) => void }) {
  const [v, setV] = useState(item.note ?? '');
  return (
    <form class="note-editor" onSubmit={(e) => { e.preventDefault(); onSave(v.trim()); }}>
      <input class="input" autoFocus maxLength={500} value={v} placeholder={t('note')} aria-label={t('note')} onInput={(e) => setV((e.target as HTMLInputElement).value)} onBlur={() => onSave(v.trim())} />
    </form>
  );
}
