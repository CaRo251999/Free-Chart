import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { ChartController } from '../chart/controller';
import { INTERVAL_SECONDS } from '../exchanges/intervals';
import { load, save } from '../data/storage';
import { uid } from '../watchlist/store';
import { fmtPrice } from '../ui/format';
import { t } from '../i18n';
import { CLICKS, DEFAULT_COLOR, type DPoint, type Drawing, type DrawingKind, type Tool } from './types';
import { completePoints, hitTest, layout, logicalToTime, snapToOhlc, timeToLogical, type Env, type Shape } from './geometry';
import { History } from './history';

export interface DrawingUiState {
  selected: Drawing | null;
  canUndo: boolean;
  canRedo: boolean;
  count: number;
  tool: Tool;
  draftHint: boolean;
}

interface Draft {
  kind: DrawingKind;
  pts: DPoint[];
  cursor: DPoint | null;
}

interface Drag {
  id: string;
  part: 'body' | number;
  start: DPoint;
  before: Drawing[];
  original: DPoint[];
  moved: boolean;
}

const MOVE_THRESHOLD = 6;

/** Draws and edits drawings on a chart using a series primitive plus pointer/touch gestures. */
export class DrawingManager {
  drawings: Drawing[] = [];
  selectedId: string | null = null;
  tool: Tool = 'cursor';
  magnet = true;
  onChange: (s: DrawingUiState) => void = () => {};

  private key = '';
  private draft: Draft | null = null;
  private drag: Drag | null = null;
  private history = new History<Drawing[]>();
  private pressing = false;
  private downPos = { x: 0, y: 0 };
  private series: ISeriesApi<SeriesType> | null = null;
  private primitive = new Primitive(this);
  private offMain: () => void;
  private cleanup: (() => void)[] = [];

  constructor(
    private ctl: ChartController,
    private el: HTMLElement,
    readOnly = false,
  ) {
    this.offMain = ctl.onMainChange((s) => {
      this.series?.detachPrimitive(this.primitive);
      this.series = s;
      s.attachPrimitive(this.primitive);
    });
    this.cleanup.push(ctl.onData(() => this.redraw()));
    ctl.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.redraw());
    if (!readOnly) this.bindEvents();
  }

  // ---------- public API ----------

  setSymbol(key: string) {
    if (key === this.key) return;
    this.key = key;
    this.drawings = load<Drawing[]>(`drawings:${key}`, []).filter((d) => d && Array.isArray(d.points) && CLICKS[d.kind] !== undefined);
    this.history.clear();
    this.selectedId = null;
    this.draft = null;
    this.notify();
    this.redraw();
  }

  setTool(tool: Tool) {
    this.tool = tool;
    this.draft = null;
    this.pressing = false;
    if (tool !== 'cursor') this.selectedId = null;
    this.el.style.cursor = tool === 'cursor' ? '' : 'crosshair';
    this.lockChart(tool !== 'cursor');
    this.notify();
    this.redraw();
  }

  setMagnet(on: boolean) {
    this.magnet = on;
  }

  select(id: string | null) {
    this.selectedId = id;
    this.notify();
    this.redraw();
  }

  patchSelected(patch: Partial<Pick<Drawing, 'color' | 'width' | 'text'>>) {
    const id = this.selectedId;
    if (!id) return;
    this.commit((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  deleteSelected() {
    const id = this.selectedId;
    if (!id) return;
    this.selectedId = null;
    this.commit((ds) => ds.filter((d) => d.id !== id));
  }

  clearAll() {
    if (!this.drawings.length) return;
    this.selectedId = null;
    this.commit(() => []);
  }

  undo() {
    const prev = this.history.undo(this.drawings);
    if (prev) this.restore(prev);
  }

  redo() {
    const next = this.history.redo(this.drawings);
    if (next) this.restore(next);
  }

  editText() {
    const d = this.drawings.find((x) => x.id === this.selectedId);
    if (!d || d.kind !== 'text') return;
    const text = window.prompt(t('textPrompt'), d.text ?? '');
    if (text !== null) this.patchSelected({ text });
  }

  destroy() {
    this.offMain();
    for (const c of this.cleanup) c();
    this.series?.detachPrimitive(this.primitive);
  }

  // ---------- state helpers ----------

  private restore(next: Drawing[]) {
    this.drawings = next;
    if (this.selectedId && !next.some((d) => d.id === this.selectedId)) this.selectedId = null;
    this.persist();
    this.notify();
    this.redraw();
  }

  private commit(mutate: (ds: Drawing[]) => Drawing[]) {
    this.history.record(this.drawings);
    this.drawings = mutate(this.drawings);
    this.persist();
    this.notify();
    this.redraw();
  }

  private persist() {
    if (this.key) save(`drawings:${this.key}`, this.drawings);
  }

  private notify() {
    this.onChange({
      selected: this.drawings.find((d) => d.id === this.selectedId) ?? null,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      count: this.drawings.length,
      tool: this.tool,
      draftHint: this.draft !== null,
    });
  }

  redraw() {
    this.primitive.requestRedraw();
  }

  private lockChart(lock: boolean) {
    this.ctl.chart.applyOptions({ handleScroll: !lock, handleScale: !lock });
  }

  // ---------- coordinate mapping ----------

  private env(W: number, H: number): Env {
    const { chart } = this.ctl;
    const series = this.series;
    const candles = this.ctl.candles;
    const step = INTERVAL_SECONDS[this.ctl.interval];
    return {
      W,
      H,
      x: (time) => {
        const l = timeToLogical(candles, step, time);
        return l === null ? null : chart.timeScale().logicalToCoordinate(l as Logical);
      },
      y: (price) => (series ? series.priceToCoordinate(price) : null),
      bars: (a, b) => (timeToLogical(candles, step, b) ?? 0) - (timeToLogical(candles, step, a) ?? 0),
      fmtPrice,
      barsText: (n) => t('barsText', { n }),
    };
  }

  private paneSize() {
    const s = this.ctl.chart.paneSize(0);
    return { W: this.ctl.chart.timeScale().width() || s.width, H: s.height };
  }

  /** Pointer -> chart point (null outside the plot area of the price pane). */
  private toPoint(clientX: number, clientY: number, snap: boolean): { p: DPoint; x: number; y: number } | null {
    const r = this.el.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const { W, H } = this.paneSize();
    if (x < 0 || y < 0 || x > W || y > H || !this.series) return null;
    const logical = this.ctl.chart.timeScale().coordinateToLogical(x);
    const price = this.series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    const candles = this.ctl.candles;
    const step = INTERVAL_SECONDS[this.ctl.interval];
    const time = logicalToTime(candles, step, logical);
    if (time === null) return null;
    if (snap && this.magnet) {
      const s = snapToOhlc(candles, step, this.env(W, H), logical, time, price, y);
      return { p: { time: s.time, price: s.price }, x, y };
    }
    return { p: { time, price }, x, y };
  }

  // ---------- gestures ----------

  private bindEvents() {
    const el = this.el;
    const down = (e: MouseEvent | TouchEvent) => this.onDown(e);
    const move = (e: MouseEvent | TouchEvent) => this.onMove(e);
    const up = () => this.onUp();
    const key = (e: KeyboardEvent) => this.onKey(e);
    const dbl = (e: MouseEvent) => this.onDblClick(e);
    el.addEventListener('mousedown', down, { capture: true });
    el.addEventListener('touchstart', down, { capture: true, passive: false });
    el.addEventListener('dblclick', dbl);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    window.addEventListener('keydown', key);
    this.cleanup.push(() => {
      el.removeEventListener('mousedown', down, { capture: true });
      el.removeEventListener('touchstart', down, { capture: true });
      el.removeEventListener('dblclick', dbl);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      window.removeEventListener('keydown', key);
    });
  }

  private xy(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if ('touches' in e) {
      if (e.touches.length !== 1 && e.type === 'touchstart') return null; // pinch: leave it to the chart
      const t0 = e.touches[0] ?? e.changedTouches[0];
      return t0 ? { x: t0.clientX, y: t0.clientY } : null;
    }
    return { x: e.clientX, y: e.clientY };
  }

  private hitAt(x: number, y: number): { d: Drawing; part: 'body' | number } | null {
    const { W, H } = this.paneSize();
    const env = this.env(W, H);
    const r = this.el.getBoundingClientRect();
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i] as Drawing;
      const hit = hitTest(d, env, x - r.left, y - r.top, 'ontouchstart' in window ? 10 : 7);
      if (hit) return { d, part: hit.part === 'body' ? 'body' : hit.index };
    }
    return null;
  }

  private onDown(e: MouseEvent | TouchEvent) {
    const c = this.xy(e);
    if (!c) {
      this.draft = null;
      return;
    }
    this.lastClient = c;
    if (this.tool !== 'cursor') {
      const hit = this.toPoint(c.x, c.y, true);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      this.pressing = true;
      this.downPos = { x: c.x, y: c.y };
      if (!this.draft) this.draft = { kind: this.tool, pts: [hit.p], cursor: hit.p };
      else this.draft.pts.push(hit.p);
      this.draft.cursor = hit.p;
      if (this.draft.pts.length >= CLICKS[this.draft.kind]) this.finish();
      else this.notify();
      this.redraw();
      return;
    }
    const hit = this.hitAt(c.x, c.y);
    if (!hit) {
      if (this.selectedId) this.select(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (this.selectedId !== hit.d.id) this.select(hit.d.id);
    const start = this.toPoint(c.x, c.y, false);
    if (!start) return;
    this.drag = { id: hit.d.id, part: hit.part, start: start.p, before: this.drawings, original: hit.d.points, moved: false };
  }

  private onMove(e: MouseEvent | TouchEvent) {
    const c = this.xy(e);
    if (!c) return;
    this.lastClient = c;
    if (this.draft) {
      const hit = this.toPoint(c.x, c.y, true);
      if (hit) {
        this.draft.cursor = hit.p;
        this.redraw();
      }
      if ('touches' in e) e.preventDefault();
      return;
    }
    if (this.drag) {
      const cur = this.toPoint(c.x, c.y, this.drag.part !== 'body');
      if (!cur) return;
      if ('touches' in e) e.preventDefault();
      const dr = this.drag;
      dr.moved = true;
      const dt = cur.p.time - dr.start.time;
      const dp = cur.p.price - dr.start.price;
      this.drawings = this.drawings.map((d) => {
        if (d.id !== dr.id) return d;
        let pts: DPoint[];
        if (dr.part === 'body') pts = dr.original.map((p) => ({ time: p.time + dt, price: p.price + dp }));
        else {
          const i = dr.part;
          pts = dr.original.slice();
          const old = pts[i] as DPoint;
          const isStop = (d.kind === 'long' || d.kind === 'short') && i === 2;
          pts[i] = d.kind === 'hline' ? { time: old.time, price: cur.p.price } : d.kind === 'vline' ? { time: cur.p.time, price: old.price } : isStop ? { time: old.time, price: cur.p.price } : cur.p;
        }
        return { ...d, points: pts };
      });
      this.redraw();
      return;
    }
    // hover feedback (mouse only)
    if (this.tool === 'cursor' && !('touches' in e) && e.buttons === 0) {
      const r = this.el.getBoundingClientRect();
      const inside = c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom;
      this.el.style.cursor = inside && this.hitAt(c.x, c.y) ? 'move' : '';
    }
  }

  private onUp() {
    if (this.drag) {
      const dr = this.drag;
      this.drag = null;
      if (dr.moved) {
        this.history.record(dr.before);
        this.persist();
        this.notify();
      }
      return;
    }
    // press-drag-release placement: the release position becomes the second point
    if (this.draft && this.pressing && this.draft.pts.length === 1 && CLICKS[this.draft.kind] >= 2) {
      const cur = this.draft.cursor;
      const moved = cur && Math.hypot(this.lastClient.x - this.downPos.x, this.lastClient.y - this.downPos.y) > MOVE_THRESHOLD;
      if (cur && moved) {
        this.draft.pts.push(cur);
        if (this.draft.pts.length >= CLICKS[this.draft.kind]) this.finish();
      }
    }
    this.pressing = false;
  }

  private lastClient = { x: 0, y: 0 };

  private finish() {
    const draft = this.draft;
    this.draft = null;
    this.pressing = false;
    if (!draft) return;
    let text: string | undefined;
    if (draft.kind === 'text') {
      const answer = window.prompt(t('textPrompt'), '');
      if (answer === null) {
        this.setTool('cursor');
        return;
      }
      text = answer;
    }
    const d: Drawing = { id: uid(), kind: draft.kind, points: completePoints(draft.kind, draft.pts), color: DEFAULT_COLOR[draft.kind], width: 2, text };
    this.selectedId = d.id;
    this.commit((ds) => [...ds, d]);
    this.setTool('cursor');
    this.selectedId = d.id;
    this.notify();
  }

  private onDblClick(e: MouseEvent) {
    const hit = this.hitAt(e.clientX, e.clientY);
    if (hit && hit.d.kind === 'text') {
      this.selectedId = hit.d.id;
      this.editText();
    }
  }

  private onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.redo();
    } else if (e.key === 'Escape') {
      if (this.draft || this.tool !== 'cursor') this.setTool('cursor');
      else if (this.selectedId) this.select(null);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
      e.preventDefault();
      this.deleteSelected();
    }
  }

  // ---------- painting ----------

  paint(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const env = this.env(W, H);
    for (const d of this.drawings) this.paintOne(ctx, d, env, d.id === this.selectedId);
    const dr = this.draft;
    if (dr?.cursor) {
      const need = CLICKS[dr.kind];
      const pts = dr.pts.length < need ? [...dr.pts, dr.cursor] : dr.pts;
      const preview: Drawing = { id: 'draft', kind: dr.kind, points: completePoints(dr.kind, pts), color: DEFAULT_COLOR[dr.kind], width: 2, text: dr.kind === 'text' ? 'Text' : undefined };
      ctx.save();
      ctx.globalAlpha = 0.8;
      this.paintOne(ctx, preview, env, true);
      ctx.restore();
    }
  }

  private paintOne(ctx: CanvasRenderingContext2D, d: Drawing, env: Env, selected: boolean) {
    const { shapes, handles } = layout(d, env);
    ctx.save();
    ctx.lineWidth = d.width;
    ctx.lineCap = 'round';
    for (const s of shapes) drawShape(ctx, s, d.color, d.width);
    if (selected) {
      for (const [hx, hy] of handles) {
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = d.color;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, color: string, width: number) {
  ctx.save();
  switch (s.t) {
    case 'line':
      ctx.globalAlpha = s.alpha ?? 1;
      ctx.strokeStyle = s.color ?? color;
      ctx.lineWidth = width;
      ctx.setLineDash(s.dash ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      break;
    case 'rect':
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color ?? color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.border) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.color ?? color;
        ctx.lineWidth = width;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      }
      break;
    case 'poly':
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      break;
    case 'arrowhead': {
      const size = 8 + width * 2;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2.2);
      ctx.lineTo(-size, size / 2.2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'text': {
      ctx.font = '12px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const w = ctx.measureText(s.text).width;
      const left = s.align === 'center' ? s.x - w / 2 : s.align === 'right' ? s.x - w : s.x;
      if (s.bg) {
        ctx.fillStyle = 'rgba(15,23,42,0.78)';
        ctx.fillRect(left - 4, s.y - 3, w + 8, 18);
      }
      ctx.fillStyle = s.color ?? color;
      ctx.fillText(s.text, left, s.y);
      break;
    }
  }
  ctx.restore();
}

class Primitive implements ISeriesPrimitive<Time> {
  private update: (() => void) | undefined;
  private view: IPrimitivePaneView;

  constructor(private m: DrawingManager) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => {
        target.useMediaCoordinateSpace(({ context, mediaSize }) => this.m.paint(context, mediaSize.width, mediaSize.height));
      },
    };
    this.view = { zOrder: () => 'top', renderer: () => renderer };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.update = p.requestUpdate;
  }
  detached() {
    this.update = undefined;
  }
  updateAllViews() {}
  paneViews() {
    return [this.view];
  }
  requestRedraw() {
    this.update?.();
  }
}
