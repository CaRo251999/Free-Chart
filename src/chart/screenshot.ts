import type { ChartController } from './controller';
import { COLORS } from './theme';
import type { Theme } from '../state';

/**
 * Renders the chart to a PNG with a title strip and an attribution footer
 * (the lightweight-charts notice must travel with shared images).
 */
export async function renderScreenshot(ctl: ChartController, title: string, theme: Theme): Promise<Blob> {
  const shot = ctl.chart.takeScreenshot(true);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const bar = Math.round(34 * dpr);
  const c = COLORS[theme];
  const out = document.createElement('canvas');
  out.width = shot.width;
  out.height = shot.height + bar * 2;
  const g = out.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = c.bg;
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(shot, 0, bar);
  g.fillStyle = c.text;
  g.textBaseline = 'middle';
  g.font = `600 ${Math.round(15 * dpr)}px system-ui, sans-serif`;
  g.fillText(title, Math.round(12 * dpr), bar / 2);
  g.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
  g.globalAlpha = 0.8;
  g.fillText('Free Chart · Charts by TradingView Lightweight Charts™ (tradingview.com)', Math.round(12 * dpr), bar + shot.height + bar / 2);
  g.textAlign = 'right';
  g.fillText(new Date().toLocaleString(), out.width - Math.round(12 * dpr), bar + shot.height + bar / 2);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('png failed'))), 'image/png'));
}

/** Shares on touch devices that support it, otherwise downloads the file. */
export async function saveOrShare(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: 'image/png' });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Free Chart' });
      return;
    } catch {
      /* cancelled: fall through to a plain download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
