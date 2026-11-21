import { ExchangeError } from './types';
import type { RateLimiter } from './rateLimiter';

/** GET JSON from a public endpoint, mapping failures to ExchangeError kinds. */
export async function getJson<T>(limiter: RateLimiter, url: string, signal?: AbortSignal): Promise<T> {
  await limiter.take();
  let res: Response;
  try {
    const timeout = AbortSignal.timeout(12000);
    res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (e) {
    // CORS failures and offline both surface as TypeError.
    throw new ExchangeError('network', e instanceof Error ? e.message : 'network error');
  }
  if (res.status === 451 || res.status === 403) throw new ExchangeError('geo', `blocked (${res.status})`, res.status);
  if (res.status === 429 || res.status === 418) throw new ExchangeError('rate', 'rate limited', res.status);
  if (res.status === 404 || res.status === 400) throw new ExchangeError('notfound', `not found (${res.status})`, res.status);
  if (!res.ok) throw new ExchangeError('bad', `HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ExchangeError('bad', 'invalid JSON');
  }
}
