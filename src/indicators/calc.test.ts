import { describe, expect, it } from 'vitest';
import type { Candle } from '../exchanges/types';
import { ADX, ATR, BOLLINGER, EMA, ICHIMOKU, MACD, OBV, PSAR, RSI, SMA, STOCHRSI, SUPERTREND, VWAP, WMA } from './calc';
import { ema, highest, lowest, sma } from './math';

const mk = (rows: [number, number, number, number?, number?][], t0 = 0, step = 3600): Candle[] =>
  rows.map(([h, l, c, v, o], i) => ({ time: t0 + i * step, open: o ?? c, high: h, low: l, close: c, volume: v ?? 1 }));
const fromCloses = (cl: number[]): Candle[] => cl.map((c, i) => ({ time: i * 3600, open: c, high: c, low: c, close: c, volume: 1 }));
const near = (a: number | null | undefined, b: number, d = 2) => {
  expect(a).not.toBeNull();
  expect(a as number).toBeCloseTo(b, d);
};

// StockCharts "Moving Averages" worked example (10-day).
const SC = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38, 22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63, 23.82, 23.87, 23.65, 23.19, 23.1, 23.33, 22.68, 23.1, 22.4, 22.17];

describe('SMA / EMA / WMA', () => {
  it('SMA(10) matches the reference table', () => {
    const s = SMA(fromCloses(SC), 10);
    expect(s.slice(0, 9).every((v) => v === null)).toBe(true);
    near(s[9], 22.22);
    near(s[10], 22.21);
    near(s[11], 22.23);
  });
  it('EMA(10) matches the reference table', () => {
    const e = EMA(fromCloses(SC), 10);
    near(e[9], 22.22);
    near(e[10], 22.21);
    near(e[11], 22.24);
    near(e[12], 22.27);
    near(e[29], 22.92, 1);
  });
  it('WMA weights the newest value most', () => {
    near(WMA(fromCloses([1, 2, 3]), 3)[2], 14 / 6, 6);
  });
  it('sma handles gaps in the input', () => {
    expect(sma([1, 2, null, 4, 5, 6], 2)).toEqual([null, 1.5, null, null, 4.5, 5.5]);
  });
  it('ema skips leading nulls before seeding', () => {
    const e = ema([null, null, 2, 4, 6], 2);
    expect(e[2]).toBeNull();
    expect(e[3]).toBe(3);
  });
});

describe('RSI', () => {
  // Unrounded closes from the original Wilder / StockCharts worksheet.
  const closes = [44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439];
  it('matches the Wilder / StockCharts example', () => {
    const r = RSI(closes, 14);
    expect(r.slice(0, 14).every((v) => v === null)).toBe(true);
    near(r[14], 70.53);
    near(r[15], 66.32);
    near(r[16], 66.55);
    near(r[17], 69.41);
    near(r[18], 66.36);
    near(r[19], 57.97);
  });
  it('is 100 on a pure uptrend and 0 on a pure downtrend', () => {
    expect(RSI([1, 2, 3, 4, 5, 6], 3)[5]).toBe(100);
    expect(RSI([6, 5, 4, 3, 2, 1], 3)[5]).toBe(0);
  });
});

describe('Bollinger', () => {
  it('uses population standard deviation', () => {
    const b = BOLLINGER(fromCloses([1, 2, 3, 4, 5]), 5, 2);
    near(b.middle[4], 3, 6);
    near(b.upper[4], 3 + 2 * Math.SQRT2, 6);
    near(b.lower[4], 3 - 2 * Math.SQRT2, 6);
    expect(b.upper[3]).toBeNull();
  });
});

describe('ATR', () => {
  it('Wilder smoothing on hand-computed true ranges', () => {
    const c = mk([[10, 8, 9], [11, 9, 10], [12, 10, 11], [13, 10, 12]]);
    const a = ATR(c, 3);
    expect(a.slice(0, 2)).toEqual([null, null]);
    near(a[2], 2, 6);
    near(a[3], (2 * 2 + 3) / 3, 6);
  });
});

describe('OBV', () => {
  it('accumulates volume by close direction', () => {
    const c = mk([[1, 1, 10, 100], [1, 1, 11, 200], [1, 1, 10.5, 150], [1, 1, 10.5, 50], [1, 1, 12, 300]]);
    expect(OBV(c)).toEqual([0, 200, 50, 50, 350]);
  });
});

describe('VWAP', () => {
  it('weights typical price by volume and resets every UTC day', () => {
    const day = 86400;
    const c: Candle[] = [
      { time: 0, open: 1, high: 12, low: 6, close: 9, volume: 1 }, // tp 9
      { time: 3600, open: 1, high: 18, low: 12, close: 15, volume: 3 }, // tp 15
      { time: day, open: 1, high: 4, low: 2, close: 3, volume: 5 }, // new day, tp 3
    ];
    const v = VWAP(c);
    near(v[0], 9, 6);
    near(v[1], (9 * 1 + 15 * 3) / 4, 6);
    near(v[2], 3, 6);
  });
});

describe('MACD', () => {
  it('is zero on a constant series', () => {
    const m = MACD(fromCloses(new Array(60).fill(5)), 12, 26, 9);
    expect(m.macd[59]).toBeCloseTo(0, 10);
    expect(m.hist[59]).toBeCloseTo(0, 10);
  });
  it('macd = EMA(fast) - EMA(slow) and hist = macd - signal', () => {
    const c = fromCloses(SC.concat(SC).concat(SC));
    const m = MACD(c, 12, 26, 9);
    const i = 80;
    near(m.macd[i], (EMA(c, 12)[i] as number) - (EMA(c, 26)[i] as number), 8);
    near(m.hist[i], (m.macd[i] as number) - (m.signal[i] as number), 8);
    expect(m.macd[24]).toBeNull();
    expect(m.macd[25]).not.toBeNull();
  });
  it('signal starts after slow+signal-1 bars', () => {
    const m = MACD(fromCloses(SC.concat(SC)), 12, 26, 9);
    expect(m.signal[32]).toBeNull();
    expect(m.signal[33]).not.toBeNull();
  });
});

describe('Stochastic RSI', () => {
  it('stays within 0..100 and K/D are smoothed series', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 5) + (i % 7));
    const s = STOCHRSI(fromCloses(closes), 14, 14, 3, 3);
    const vals = [...s.k, ...s.d].filter((v): v is number => v !== null);
    expect(vals.length).toBeGreaterThan(100);
    expect(vals.every((v) => v >= -1e-9 && v <= 100 + 1e-9)).toBe(true);
    expect(s.k.findIndex((v) => v !== null)).toBe(14 + 14 - 1 + 2);
  });
});

describe('ADX', () => {
  it('reaches 100 on a perfectly directional market', () => {
    const c = mk(Array.from({ length: 40 }, (_, i) => [i + 2, i, i + 1] as [number, number, number]));
    const a = ADX(c, 5);
    near(a.adx[39], 100, 6);
    expect((a.plus[39] as number) > (a.minus[39] as number)).toBe(true);
    expect(a.minus[39]).toBe(0);
  });
  it('is ~0 when up and down moves cancel', () => {
    const c = mk(Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? [11, 9, 10] : [12, 10, 11]) as [number, number, number]));
    const a = ADX(c, 5);
    expect(a.adx[59] as number).toBeLessThan(15);
  });
  it('first ADX appears after 2*period-1 bars', () => {
    const c = mk(Array.from({ length: 40 }, (_, i) => [i + 2, i, i + 1] as [number, number, number]));
    const a = ADX(c, 5);
    expect(a.adx[8]).toBeNull();
    expect(a.adx[9]).not.toBeNull();
    expect(a.plus[4]).toBeNull();
    expect(a.plus[5]).not.toBeNull();
  });
});

describe('Parabolic SAR', () => {
  it('matches a hand-computed run including a reversal', () => {
    const c: Candle[] = [
      { time: 0, open: 9, high: 10, low: 9, close: 9.5, volume: 1 },
      { time: 1, open: 10, high: 11, low: 10, close: 10.5, volume: 1 },
      { time: 2, open: 11, high: 12, low: 11, close: 11.5, volume: 1 },
      { time: 3, open: 12, high: 13, low: 12, close: 12.5, volume: 1 },
      { time: 4, open: 13, high: 14, low: 13, close: 13.5, volume: 1 },
      { time: 5, open: 13, high: 14, low: 9, close: 9.2, volume: 1 },
    ];
    const s = PSAR(c, 0.02, 0.2);
    [9, 9, 9, 9.18, 9.4856, 14].forEach((v, i) => near(s[i], v, 6));
  });
});

describe('Supertrend', () => {
  it('follows an uptrend below price and flips on a sharp drop', () => {
    const rows: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [i + 1.5, i + 0.5, i + 1]);
    for (let k = 0; k < 6; k++) rows.push([30 - k * 5, 25 - k * 5, 26 - k * 5]);
    const c = mk(rows);
    const st = SUPERTREND(c, 5, 2);
    expect(st.trend[29]).toBe(1);
    const ups = st.up.slice(5, 30) as number[];
    expect(ups.every((v, i) => v < (c[i + 5] as Candle).close)).toBe(true);
    expect(ups.every((v, i) => i === 0 || v >= (ups[i - 1] as number))).toBe(true);
    expect(st.trend[35]).toBe(-1);
    expect(st.down[35]).toBeGreaterThan((c[35] as Candle).close);
  });
});

describe('Ichimoku', () => {
  it('matches a naive recomputation', () => {
    const rows: [number, number, number][] = Array.from({ length: 60 }, (_, i) => [50 + 5 * Math.sin(i / 4) + 2, 50 + 5 * Math.sin(i / 4) - 2, 50 + 5 * Math.sin(i / 4)]);
    const c = mk(rows);
    const ich = ICHIMOKU(c, 9, 26, 52);
    const naive = (n: number, i: number) => {
      const w = c.slice(i - n + 1, i + 1);
      return (Math.max(...w.map((x) => x.high)) + Math.min(...w.map((x) => x.low))) / 2;
    };
    near(ich.tenkan[40], naive(9, 40), 9);
    near(ich.kijun[40], naive(26, 40), 9);
    near(ich.spanB[59], naive(52, 59), 9);
    near(ich.spanA[40], (naive(9, 40) + naive(26, 40)) / 2, 9);
    expect(ich.kijun[24]).toBeNull();
    expect(ich.spanB[50]).toBeNull();
    expect(ich.chikou[10]).toBe((c[10] as Candle).close);
  });
  it('highest / lowest windows', () => {
    expect(highest([1, 3, 2, 5], 2)).toEqual([null, 3, 3, 5]);
    expect(lowest([4, 3, 2, 5], 3)).toEqual([null, null, 2, 2]);
  });
});
