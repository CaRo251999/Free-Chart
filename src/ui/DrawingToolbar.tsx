import { t } from '../i18n';
import { magnet } from '../state';
import { drawingMgr, drawingUi } from '../drawing/state';
import { TOOL_ICON, TOOL_ORDER, type DrawingKind } from '../drawing/types';
import type { Key } from '../i18n/es';

const LABEL: Record<DrawingKind, Key> = {
  trend: 'trendline', ray: 'ray', hline: 'hline', vline: 'vline', channel: 'channel', rect: 'rect', fib: 'fib',
  text: 'text', arrow: 'arrow', ruler: 'ruler', long: 'longPos', short: 'shortPos',
};

export function DrawingToolbar() {
  const m = drawingMgr.value;
  const ui = drawingUi.value;
  if (!m) return null;
  const sel = ui.selected;
  return (
    <>
      <div class="draw-toolbar" role="toolbar" aria-label={t('drawing')}>
        <button class={`dt${ui.tool === 'cursor' ? ' active' : ''}`} aria-pressed={ui.tool === 'cursor'} title={t('cursor')} aria-label={t('cursor')} onClick={() => m.setTool('cursor')}>✥</button>
        {TOOL_ORDER.map((k) => (
          <button key={k} class={`dt${ui.tool === k ? ' active' : ''}`} aria-pressed={ui.tool === k} title={t(LABEL[k])} aria-label={t(LABEL[k])} onClick={() => m.setTool(ui.tool === k ? 'cursor' : k)}>
            {TOOL_ICON[k]}
          </button>
        ))}
        <span class="dt-sep" />
        <button class={`dt${magnet.value ? ' active' : ''}`} aria-pressed={magnet.value} title={t('magnet')} aria-label={t('magnet')} onClick={() => (magnet.value = !magnet.value)}>⌖</button>
        <button class="dt" disabled={!ui.canUndo} title={`${t('undo')} (Ctrl+Z)`} aria-label={t('undo')} onClick={() => m.undo()}>↶</button>
        <button class="dt" disabled={!ui.canRedo} title={`${t('redo')} (Ctrl+Y)`} aria-label={t('redo')} onClick={() => m.redo()}>↷</button>
        <button class="dt" disabled={ui.count === 0} title={t('clearDrawings')} aria-label={t('clearDrawings')} onClick={() => m.clearAll()}>🗑</button>
      </div>
      {sel && (
        <div class="draw-edit" role="group" aria-label={t('drawing')}>
          <input type="color" class="color-in" aria-label={t('color')} value={sel.color} onInput={(e) => m.patchSelected({ color: (e.target as HTMLInputElement).value })} />
          <select class="select" aria-label={t('width')} value={sel.width} onChange={(e) => m.patchSelected({ width: Number((e.target as HTMLSelectElement).value) })}>
            {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}px</option>)}
          </select>
          {sel.kind === 'text' && <button class="btn" onClick={() => m.editText()}>{t('text')}</button>}
          <button class="btn" onClick={() => m.deleteSelected()} aria-label={t('deleteDrawing')}>🗑 {t('deleteDrawing')}</button>
        </div>
      )}
    </>
  );
}
