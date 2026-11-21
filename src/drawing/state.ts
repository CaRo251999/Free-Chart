import { signal } from '@preact/signals';
import type { DrawingManager, DrawingUiState } from './manager';

/** The manager of the primary chart (the one the drawing toolbar controls). */
export const drawingMgr = signal<DrawingManager | null>(null);

export const drawingUi = signal<DrawingUiState>({ selected: null, canUndo: false, canRedo: false, count: 0, tool: 'cursor', draftHint: false });
