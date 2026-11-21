import { interval, layout, magnet, sidebarOpen, theme, type LayoutKind } from '../state';
import { INTERVALS } from '../exchanges/intervals';
import { lang, setLang } from '../i18n';
import { drawingMgr } from '../drawing/state';
import type { DrawingKind } from '../drawing/types';
import type { Key } from '../i18n/es';
import { modal } from './uiState';
import { takeScreenshot } from './screenshotAction';

/** [keys, description key] — rendered by the help dialog. */
export const SHORTCUTS: [string, Key][] = [
  ['1 – 7', 'scInterval'],
  ['/  ·  Ctrl+K', 'scSearch'],
  ['T', 'scTheme'],
  ['L', 'scLayout'],
  ['W', 'scSidebar'],
  ['I', 'scIndicators'],
  ['A', 'scAlerts'],
  ['S', 'scShot'],
  ['M', 'scMagnet'],
  ['G', 'scLang'],
  ['Alt + T H V C R F X A M P', 'scDraw'],
  ['Ctrl+Z  /  Ctrl+Y', 'scUndo'],
  ['Del', 'scDelete'],
  ['Esc', 'scEsc'],
  ['?', 'scHelp'],
];

const DRAW_KEYS: Record<string, DrawingKind> = {
  t: 'trend', h: 'hline', v: 'vline', c: 'channel', r: 'rect', f: 'fib', x: 'text', a: 'arrow', m: 'ruler', p: 'long',
};

const NEXT_LAYOUT: Record<LayoutKind, LayoutKind> = { 1: 2, 2: 4, 4: 1 };

/** Global single-key shortcuts; ignored while typing in a form field. */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    const k = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && k === 'k') {
      e.preventDefault();
      modal.value = 'search';
      return;
    }
    if (e.ctrlKey || e.metaKey) return; // leave Ctrl+Z / Ctrl+Y etc. to their owners

    if (e.altKey) {
      const kind = DRAW_KEYS[e.code.replace('Key', '').toLowerCase()];
      if (kind) {
        e.preventDefault();
        drawingMgr.value?.setTool(kind);
      }
      return;
    }
    if (modal.value && k !== '?') return; // dialogs own the keyboard

    const n = Number(k);
    if (n >= 1 && n <= INTERVALS.length) {
      interval.value = INTERVALS[n - 1] as (typeof INTERVALS)[number];
      return;
    }
    switch (k) {
      case '/': e.preventDefault(); modal.value = 'search'; break;
      case 't': theme.value = theme.value === 'dark' ? 'light' : 'dark'; break;
      case 'l': layout.value = NEXT_LAYOUT[layout.value]; break;
      case 'w': sidebarOpen.value = !sidebarOpen.value; break;
      case 'i': modal.value = 'indicators'; break;
      case 'a': modal.value = 'alerts'; break;
      case 's': void takeScreenshot(); break;
      case 'm': magnet.value = !magnet.value; break;
      case 'g': setLang(lang.value === 'es' ? 'en' : 'es'); break;
      case '?': modal.value = modal.value === 'help' ? null : 'help'; break;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
