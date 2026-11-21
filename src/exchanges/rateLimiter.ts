/** Token bucket: up to `capacity` bursts, refilled at `perSecond`. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private capacity: number,
    private perSecond: number,
    private now: () => number = () => Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
  }

  /** Resolves when a token is available (calls are served in order). */
  take(): Promise<void> {
    const run = async () => {
      for (;;) {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          return;
        }
        const wait = Math.ceil(((1 - this.tokens) / this.perSecond) * 1000);
        await new Promise((r) => setTimeout(r, wait));
      }
    };
    const p = this.queue.then(run);
    this.queue = p.catch(() => undefined);
    return p;
  }
}
