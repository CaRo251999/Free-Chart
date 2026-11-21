import { signal } from '@preact/signals';
import type { ChartController } from '../chart/controller';

export type ModalId = 'search' | 'indicators' | 'alerts' | 'help' | 'backup' | 'compare' | null;

/** Which global modal is open (also driven by keyboard shortcuts). */
export const modal = signal<ModalId>(null);

/** The primary chart controller (used for screenshots). */
export const primaryChart = signal<ChartController | null>(null);
