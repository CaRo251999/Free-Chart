import { useState } from 'preact/hooks';
import { Modal } from './Modal';
import { t } from '../i18n';
import { BY_ID, INDICATORS } from '../indicators/registry';
import { addIndicator, applyTemplate, deleteTemplate, indicators, removeIndicator, saveTemplate, templates, updateIndicator } from '../indicators/state';

export function IndicatorPanel({ onClose }: { onClose: () => void }) {
  const [tpl, setTpl] = useState('');
  const overlays = INDICATORS.filter((d) => d.placement === 'overlay');
  const panes = INDICATORS.filter((d) => d.placement === 'pane');

  return (
    <Modal title={t('indicators')} onClose={onClose} wide>
      <div class="ind-grid">
        <section>
          <h3>{t('addIndicator')}</h3>
          <h4 class="muted">{t('overlayGroup')}</h4>
          <div class="ind-add">
            {overlays.map((d) => (
              <button key={d.id} class="btn" onClick={() => addIndicator(d.id)}>＋ {d.name}</button>
            ))}
          </div>
          <h4 class="muted">{t('paneGroup')}</h4>
          <div class="ind-add">
            {panes.map((d) => (
              <button key={d.id} class="btn" onClick={() => addIndicator(d.id)}>＋ {d.name}</button>
            ))}
          </div>

          <h3>{t('templates')}</h3>
          <form class="row" onSubmit={(e) => { e.preventDefault(); saveTemplate(tpl); setTpl(''); }}>
            <input class="input" value={tpl} maxLength={60} placeholder={t('templateName')} aria-label={t('templateName')} onInput={(e) => setTpl((e.target as HTMLInputElement).value)} />
            <button class="btn" type="submit" disabled={!tpl.trim() || indicators.value.length === 0}>{t('saveTemplate')}</button>
          </form>
          <ul class="tpl-list">
            {templates.value.map((x) => (
              <li key={x.name} class="row">
                <span class="grow">{x.name} <span class="muted">({x.items.length})</span></span>
                <button class="btn" onClick={() => applyTemplate(x.name)}>{t('applyTemplate')}</button>
                <button class="btn icon" aria-label={t('remove')} onClick={() => deleteTemplate(x.name)}>✕</button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>{t('indicators')} ({indicators.value.length})</h3>
          {indicators.value.length === 0 && <p class="muted">{t('noIndicators')}</p>}
          {indicators.value.map((inst) => {
            const def = BY_ID[inst.id];
            if (!def) return null;
            return (
              <div class="ind-card" key={inst.uid}>
                <div class="row">
                  <strong class="grow">{def.name}</strong>
                  <button class="btn icon" aria-label={`${t('remove')} ${def.name}`} onClick={() => removeIndicator(inst.uid)}>✕</button>
                </div>
                <div class="ind-fields">
                  {def.params.map((p) => (
                    <label key={p.key}>
                      <span class="muted">{p.label}</span>
                      <input
                        class="input num-in"
                        type="number"
                        min={p.min}
                        max={p.max}
                        step={p.step ?? 1}
                        value={inst.params[p.key]}
                        onChange={(e) => updateIndicator(inst.uid, { params: { ...inst.params, [p.key]: Number((e.target as HTMLInputElement).value) } })}
                      />
                    </label>
                  ))}
                  <label>
                    <span class="muted">{t('width')}</span>
                    <select class="select" value={inst.width} onChange={(e) => updateIndicator(inst.uid, { width: Number((e.target as HTMLSelectElement).value) })}>
                      {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                </div>
                <div class="ind-fields">
                  {def.lines.map((l, i) => (
                    <label key={l.key}>
                      <span class="muted">{l.label}</span>
                      <input
                        type="color"
                        class="color-in"
                        aria-label={`${t('color')} ${l.label}`}
                        value={inst.colors[i] ?? l.color}
                        onInput={(e) => {
                          const colors = inst.colors.slice();
                          colors[i] = (e.target as HTMLInputElement).value;
                          updateIndicator(inst.uid, { colors });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </Modal>
  );
}
