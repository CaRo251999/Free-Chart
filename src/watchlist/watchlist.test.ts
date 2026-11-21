import { describe, expect, it } from 'vitest';
import { moveItem, type WList } from './store';
import { exportCsv, exportJson, parseCsv, parseCsvRows, parseJson, sanitizeItem } from './importExport';
import { decodeList, encodeList, shareCodeFromHash } from './shareLink';

const list: WList = {
  id: 'x',
  name: 'Mi lista',
  items: [
    { base: 'BTC', quote: 'USD', flag: 'red', note: 'soporte, "clave"' },
    { base: 'ETH', quote: 'USDT', pref: 'kraken' },
  ],
};

describe('moveItem', () => {
  it('reorders without mutating', () => {
    const a = [1, 2, 3, 4];
    expect(moveItem(a, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem(a, 3, 0)).toEqual([4, 1, 2, 3]);
    expect(a).toEqual([1, 2, 3, 4]);
    expect(moveItem(a, 1, 9)).toBe(a);
  });
});

describe('sanitizeItem', () => {
  it('uppercases and rejects junk', () => {
    expect(sanitizeItem({ base: 'btc', quote: 'usd' })).toEqual({ base: 'BTC', quote: 'USD' });
    expect(sanitizeItem({ base: '<script>', quote: 'USD' })).toBeNull();
    expect(sanitizeItem({ base: 'BTC', quote: 'USD', flag: 'pink', pref: 'nope' })).toEqual({ base: 'BTC', quote: 'USD' });
  });
});

describe('JSON import/export', () => {
  it('round-trips', () => {
    const back = parseJson(exportJson([list]));
    expect(back).toEqual([{ name: 'Mi lista', items: list.items }]);
  });
  it('rejects garbage', () => {
    expect(() => parseJson('{"nope":1}')).toThrow();
    expect(() => parseJson('not json')).toThrow();
  });
  it('de-duplicates items', () => {
    const out = parseJson(JSON.stringify({ lists: [{ name: 'a', items: [{ base: 'BTC', quote: 'USD' }, { base: 'btc', quote: 'usd' }] }] }));
    expect(out[0]?.items).toHaveLength(1);
  });
});

describe('CSV import/export', () => {
  it('escapes quotes and commas and round-trips', () => {
    const csv = exportCsv(list);
    expect(csv.split('\n')[1]).toBe('BTC/USD,auto,red,"soporte, ""clave"""');
    const back = parseCsv(csv, 'x');
    expect(back.items).toEqual(list.items);
  });
  it('accepts a headerless list of symbols', () => {
    expect(parseCsv('btc-usd\neth/usdt\n').items.map((i) => `${i.base}/${i.quote}`)).toEqual(['BTC/USD', 'ETH/USDT']);
  });
  it('parses CRLF and BOM', () => {
    expect(parseCsvRows('a,b\r\nc,"d\ne"\r\n')).toEqual([['a', 'b'], ['c', 'd\ne']]);
    expect(parseCsv('﻿symbol\r\nBTC/USD\r\n').items).toHaveLength(1);
  });
  it('throws when nothing valid', () => {
    expect(() => parseCsv('symbol\n!!!\n')).toThrow();
  });
});

describe('share link', () => {
  it('round-trips a list through the URL encoding', async () => {
    const code = await encodeList(list.name, list.items);
    expect(/^[zj][A-Za-z0-9_-]+$/.test(code)).toBe(true);
    const back = await decodeList(code);
    expect(back.name).toBe('Mi lista');
    expect(back.items).toEqual([{ base: 'BTC', quote: 'USD', flag: 'red', note: 'soporte, "clave"' }, { base: 'ETH', quote: 'USDT' }]);
  });
  it('handles large lists compactly', async () => {
    const items = Array.from({ length: 300 }, (_, i) => ({ base: `COIN${i}`, quote: 'USDT' }));
    const code = await encodeList('big', items);
    expect((await decodeList(code)).items).toHaveLength(300);
  });
  it('rejects tampered codes', async () => {
    await expect(decodeList('zAAAA')).rejects.toThrow();
  });
  it('reads the code from the hash', () => {
    expect(shareCodeFromHash('#/s=zabc-_1')).toBe('zabc-_1');
    expect(shareCodeFromHash('#/credits')).toBeNull();
  });
});
