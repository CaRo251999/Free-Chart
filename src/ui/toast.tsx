import { signal } from '@preact/signals';

export const toasts = signal<{ id: number; text: string }[]>([]);
let n = 0;

/** Shows a short, screen-reader friendly message. */
export function toast(text: string, ms = 3500) {
  const id = ++n;
  toasts.value = [...toasts.value, { id, text }];
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== id)), ms);
}

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((x) => (
        <div class="toast" key={x.id}>{x.text}</div>
      ))}
    </div>
  );
}
