import type { StreamState } from './types';

/** Exponential backoff with jitter: min*2^attempt capped at max, scaled to 50-100%. */
export function backoffDelay(attempt: number, min = 1000, max = 30000, rand: () => number = Math.random): number {
  return Math.min(max, min * 2 ** attempt) * (0.5 + rand() * 0.5);
}

export interface SocketOptions {
  url: string;
  /** Called on every (re)connection: send subscription messages here. */
  onOpen?: (send: (data: string) => void) => void;
  onMessage: (data: string) => void;
  onState?: (s: StreamState) => void;
  WebSocketImpl?: typeof WebSocket;
  rand?: () => number;
}

/** WebSocket that reconnects automatically until close() is called. */
export class ReconnectingSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private o: SocketOptions) {
    this.connect();
  }

  private connect() {
    if (this.stopped) return;
    this.o.onState?.(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const Impl = this.o.WebSocketImpl ?? WebSocket;
    const ws = new Impl(this.o.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.o.onState?.('open');
      this.o.onOpen?.((d) => ws.readyState === 1 && ws.send(d));
    };
    ws.onmessage = (e) => this.o.onMessage(String(e.data));
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (this.stopped) return;
      this.o.onState?.('reconnecting');
      const delay = backoffDelay(this.attempt++, 1000, 30000, this.o.rand);
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  send(data: string) {
    if (this.ws?.readyState === 1) this.ws.send(data);
  }

  close() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.o.onState?.('closed');
  }
}
