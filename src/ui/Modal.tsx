import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  wide?: boolean;
}

/** Accessible modal: Esc closes, backdrop click closes, role=dialog. */
export function Modal({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="modal-head">
          <h2>{title}</h2>
          <button class="btn icon" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}
