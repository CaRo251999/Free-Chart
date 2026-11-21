/** Snapshot-based undo/redo. States are treated as immutable values. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private limit = 100) {}

  /** Call with the state *before* a change is applied. */
  record(before: T) {
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: T): T | undefined {
    const prev = this.past.pop();
    if (prev === undefined) return undefined;
    this.future.push(current);
    return prev;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
