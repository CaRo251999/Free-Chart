import type { Candle } from '../exchanges/types';
import { ema, highest, lowest, rma, sma, wma, type Series } from './math';

const closes = (c: Candle[]): Series => c.map((x) => x.close);

// ---------- Overlays ----------

export const SMA = (c: Candle[], period: number) => sma(closes(c), period);
export const EMA = (c: Candle[], period: number) => ema(closes(c), period);
export const WMA = (c: Candle[], period: number) => wma(closes(c), period);

/** Session VWAP: typical price weighted by volume, reset at 00:00 UTC. */
export function VWAP(c: Candle[]): Series {
  const out: Series = [];
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (const k of c) {
    const d = Math.floor(k.time / 86400);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    pv += ((k.high + k.low + k.close) / 3) * k.volume;
    vol += k.volume;
    out.push(vol > 0 ? pv / vol : (k.high + k.low + k.close) / 3);
  }
  return out;
}

/** Bollinger Bands using the population standard deviation (as TradingView does). */
export function BOLLINGER(c: Candle[], period: number, mult: number): { middle: Series; upper: Series; lower: Series } {
  const mid = sma(closes(c), period);
  const upper: Series = new Array(c.length).fill(null);
  const lower: Series = new Array(c.length).fill(null);
  for (let i = period - 1; i < c.length; i++) {
    const m = mid[i] as number;
    let v = 0;
    for (let k = i - period + 1; k <= i; k++) v += ((c[k] as Candle).close - m) ** 2;
    const sd = Math.sqrt(v / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { middle: mid, upper, lower };
}

/** Ichimoku Cloud. Span A/B are returned unshifted: draw them `displacement` bars ahead, Chikou that many behind. */
export function ICHIMOKU(c: Candle[], conv: number, base: number, spanB: number) {
  const hi: Series = c.map((x) => x.high);
  const lo: Series = c.map((x) => x.low);
  const mid = (n: number): Series => {
    const h = highest(hi, n);
    const l = lowest(lo, n);
    return h.map((v, i) => (v === null || l[i] === null ? null : (v + (l[i] as number)) / 2));
  };
  const tenkan = mid(conv);
  const kijun = mid(base);
  const spanA: Series = tenkan.map((v, i) => (v === null || kijun[i] === null ? null : (v + (kijun[i] as number)) / 2));
  return { tenkan, kijun, spanA, spanB: mid(spanB), chikou: closes(c) };
}

/** Wilder ATR (RMA of the true range). */
export function ATR(c: Candle[], period: number): Series {
  return rma(trueRange(c), period);
}

function trueRange(c: Candle[]): number[] {
  return c.map((k, i) => {
    if (i === 0) return k.high - k.low;
    const pc = (c[i - 1] as Candle).close;
    return Math.max(k.high - k.low, Math.abs(k.high - pc), Math.abs(k.low - pc));
  });
}

/** Supertrend. `up` is the lower band while the trend is up; `down` the upper band while down. */
export function SUPERTREND(c: Candle[], period: number, mult: number): { up: Series; down: Series; trend: (1 | -1 | 0)[] } {
  const atr = ATR(c, period);
  const n = c.length;
  const up: Series = new Array(n).fill(null);
  const down: Series = new Array(n).fill(null);
  const trend: (1 | -1 | 0)[] = new Array(n).fill(0);
  let fu = 0;
  let fl = 0;
  let dir: 1 | -1 = 1;
  let started = false;
  for (let i = 0; i < n; i++) {
    const a = atr[i];
    if (a === null || a === undefined) continue;
    const k = c[i] as Candle;
    const hl2 = (k.high + k.low) / 2;
    const bu = hl2 + mult * a;
    const bl = hl2 - mult * a;
    if (!started) {
      fu = bu;
      fl = bl;
      dir = k.close >= hl2 ? 1 : -1;
      started = true;
    } else {
      const pc = (c[i - 1] as Candle).close;
      const nfu = bu < fu || pc > fu ? bu : fu;
      const nfl = bl > fl || pc < fl ? bl : fl;
      fu = nfu;
      fl = nfl;
      if (dir === 1 && k.close < fl) dir = -1;
      else if (dir === -1 && k.close > fu) dir = 1;
    }
    trend[i] = dir;
    if (dir === 1) up[i] = fl;
    else down[i] = fu;
  }
  return { up, down, trend };
}

/** Parabolic SAR (Wilder): acceleration `step` up to `max`. */
export function PSAR(c: Candle[], step: number, max: number): Series {
  const n = c.length;
  const out: Series = new Array(n).fill(null);
  if (n < 2) return out;
  let uptrend = (c[1] as Candle).close >= (c[0] as Candle).close;
  let sar = uptrend ? (c[0] as Candle).low : (c[0] as Candle).high;
  let ep = uptrend ? (c[0] as Candle).high : (c[0] as Candle).low;
  let af = step;
  out[0] = sar;
  for (let i = 1; i < n; i++) {
    const k = c[i] as Candle;
    const p1 = c[i - 1] as Candle;
    const p2 = (c[i - 2] ?? p1) as Candle;
    sar = sar + af * (ep - sar);
    if (uptrend) {
      sar = Math.min(sar, p1.low, p2.low);
      if (k.low < sar) {
        uptrend = false;
        sar = ep;
        ep = k.low;
        af = step;
      } else if (k.high > ep) {
        ep = k.high;
        af = Math.min(af + step, max);
      }
    } else {
      sar = Math.max(sar, p1.high, p2.high);
      if (k.high > sar) {
        uptrend = true;
        sar = ep;
        ep = k.high;
        af = step;
      } else if (k.low < ep) {
        ep = k.low;
        af = Math.min(af + step, max);
      }
    }
    out[i] = sar;
  }
  return out;
}

// ---------- Panels ----------

/** Wilder RSI. */
export function RSI(src: Series, period: number): Series {
  const out: Series = new Array(src.length).fill(null);
  let avgG = 0;
  let avgL = 0;
  for (let i = 1; i < src.length; i++) {
    const cur = src[i];
    const prev = src[i - 1];
    if (cur === null || cur === undefined || prev === null || prev === undefined) continue;
    const ch = cur - prev;
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    if (i < period) {
      avgG += g;
      avgL += l;
    } else if (i === period) {
      avgG = (avgG + g) / period;
      avgL = (avgL + l) / period;
      out[i] = rsiValue(avgG, avgL);
    } else {
      avgG = (avgG * (period - 1) + g) / period;
      avgL = (avgL * (period - 1) + l) / period;
      out[i] = rsiValue(avgG, avgL);
    }
  }
  return out;
}
const rsiValue = (g: number, l: number) => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l));

export function MACD(c: Candle[], fast: number, slow: number, signalP: number): { macd: Series; signal: Series; hist: Series } {
  const cl = closes(c);
  const f = ema(cl, fast);
  const s = ema(cl, slow);
  const macd: Series = f.map((v, i) => (v === null || s[i] === null ? null : v - (s[i] as number)));
  const signal = ema(macd, signalP);
  const hist: Series = macd.map((v, i) => (v === null || signal[i] === null ? null : v - (signal[i] as number)));
  return { macd, signal, hist };
}

/** Stochastic RSI (TradingView definition): returns smoothed %K and %D on a 0-100 scale. */
export function STOCHRSI(c: Candle[], rsiP: number, stochP: number, kP: number, dP: number): { k: Series; d: Series } {
  const rsi = RSI(closes(c), rsiP);
  const hh = highest(rsi, stochP);
  const ll = lowest(rsi, stochP);
  const raw: Series = rsi.map((v, i) => {
    if (v === null || hh[i] === null || ll[i] === null) return null;
    const range = (hh[i] as number) - (ll[i] as number);
    return range === 0 ? 0 : (100 * (v - (ll[i] as number))) / range;
  });
  const k = sma(raw, kP);
  return { k, d: sma(k, dP) };
}

export function OBV(c: Candle[]): Series {
  const out: Series = [];
  let acc = 0;
  c.forEach((k, i) => {
    if (i > 0) {
      const pc = (c[i - 1] as Candle).close;
      if (k.close > pc) acc += k.volume;
      else if (k.close < pc) acc -= k.volume;
    }
    out.push(acc);
  });
  return out;
}

/** Wilder ADX with +DI / -DI. */
export function ADX(c: Candle[], period: number): { adx: Series; plus: Series; minus: Series } {
  const n = c.length;
  const adx: Series = new Array(n).fill(null);
  const plus: Series = new Array(n).fill(null);
  const minus: Series = new Array(n).fill(null);
  if (n <= period) return { adx, plus, minus };
  const tr = trueRange(c);
  let sTR = 0;
  let sP = 0;
  let sM = 0;
  const dx: number[] = [];
  let adxPrev: number | null = null;
  for (let i = 1; i < n; i++) {
    const k = c[i] as Candle;
    const p = c[i - 1] as Candle;
    const up = k.high - p.high;
    const dn = p.low - k.low;
    const pdm = up > dn && up > 0 ? up : 0;
    const mdm = dn > up && dn > 0 ? dn : 0;
    if (i <= period) {
      sTR += tr[i] as number;
      sP += pdm;
      sM += mdm;
      if (i < period) continue;
    } else {
      sTR = sTR - sTR / period + (tr[i] as number);
      sP = sP - sP / period + pdm;
      sM = sM - sM / period + mdm;
    }
    const pdi = sTR === 0 ? 0 : (100 * sP) / sTR;
    const mdi = sTR === 0 ? 0 : (100 * sM) / sTR;
    plus[i] = pdi;
    minus[i] = mdi;
    const sum = pdi + mdi;
    const d = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
    if (adxPrev === null) {
      dx.push(d);
      if (dx.length === period) {
        adxPrev = dx.reduce((a, b) => a + b, 0) / period;
        adx[i] = adxPrev;
      }
    } else {
      adxPrev = (adxPrev * (period - 1) + d) / period;
      adx[i] = adxPrev;
    }
  }
  return { adx, plus, minus };
}
