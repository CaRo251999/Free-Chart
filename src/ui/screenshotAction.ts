import { primaryChart } from './uiState';
import { renderScreenshot, saveOrShare } from '../chart/screenshot';
import { interval, theme } from '../state';
import { pairKey } from '../exchanges/symbols';
import { ADAPTERS } from '../exchanges/registry';
import { toast } from './toast';
import { t } from '../i18n';

/** Captures the primary chart (with drawings and indicators) as a PNG. */
export async function takeScreenshot() {
  const ctl = primaryChart.value;
  if (!ctl?.pair) return;
  const ex = ctl.status.exchange ? ` · ${ADAPTERS[ctl.status.exchange].name}` : '';
  const title = `${pairKey(ctl.pair)} · ${interval.value}${ex}`;
  try {
    const blob = await renderScreenshot(ctl, title, theme.value);
    await saveOrShare(blob, `free-chart-${ctl.pair.base}${ctl.pair.quote}-${interval.value}.png`);
    toast(t('shotSaved'));
  } catch {
    /* screenshot is best-effort */
  }
}
