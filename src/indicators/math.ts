export type Series = (number | null)[];

/** Simple moving average; null until `n` consecutive valid values exist. */
export function sma(src: Series, n: number): Series {
  const out: Series = new Array(src.length).fill(null);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v === null || v === undefined) {
      sum = 0;
      count = 0;
      continue;
    }
    sum += v;
    count++;
    if (count > n) sum -= src[i - n] as number;
    if (count >= n) out[i] = sum / n;
  }
  return out;
}

/** Exponential moving average seeded with the SMA of the first `n` values (alpha = 2/(n+1)). */
export function ema(src: Series, n: number): Series {
  return smoothed(src, n, 2 / (n + 1));
}

/** Wilder's smoothing (RMA): alpha = 1/n, seeded with SMA. */
export function rma(src: Series, n: number): Series {
  return smoothed(src, n, 1 / n);
}

function smoothed(src: Series, n: number, alpha: number): Series {
  const out: Series = new Array(src.length).fill(null);
  let prev: number | null = null;
  let seed = 0;
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v === null || v === undefined) continue;
    if (prev === null) {
      seed += v;
      count++;
      if (count === n) {
        prev = seed / n;
        out[i] = prev;
      }
    } else {
      prev = prev + alpha * (v - prev);
      out[i] = prev;
    }
  }
  return out;
}

/** Linearly weighted moving average (weights 1..n, newest heaviest). */
export function wma(src: Series, n: number): Series {
  const out: Series = new Array(src.length).fill(null);
  const denom = (n * (n + 1)) / 2;
  for (let i = n - 1; i < src.length; i++) {
    let s = 0;
    let ok = true;
    for (let k = 0; k < n; k++) {
      const v = src[i - n + 1 + k];
      if (v === null || v === undefined) {
        ok = false;
        break;
      }
      s += v * (k + 1);
    }
    if (ok) out[i] = s / denom;
  }
  return out;
}

export function highest(src: Series, n: number): Series {
  return window(src, n, Math.max);
}
export function lowest(src: Series, n: number): Series {
  return window(src, n, Math.min);
}
function window(src: Series, n: number, fn: (...v: number[]) => number): Series {
  const out: Series = new Array(src.length).fill(null);
  for (let i = n - 1; i < src.length; i++) {
    const vals: number[] = [];
    for (let k = i - n + 1; k <= i; k++) {
      const v = src[k];
      if (v === null || v === undefined) break;
      vals.push(v);
    }
    if (vals.length === n) out[i] = fn(...vals);
  }
  return out;
}

export const round = (x: number | null, d = 2) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);
