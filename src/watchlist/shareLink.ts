import { FLAGS, type WItem } from './store';
import { sanitizeList } from './importExport';

type Payload = { n: string; i: [string, string, number?, string?][] };

const toB64Url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(data);
      c.close();
    },
  });
  const out = new Response(source.pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * Encodes a list into a URL-safe string: JSON -> deflate (when available) -> base64url.
 * A leading "z" marks compressed payloads, "j" plain ones. Nothing leaves the browser.
 */
export async function encodeList(name: string, items: WItem[]): Promise<string> {
  const payload: Payload = {
    n: name,
    i: items.map((x) => {
      const row: [string, string, number?, string?] = [x.base, x.quote];
      const flag = x.flag ? FLAGS.indexOf(x.flag) : -1;
      if (flag >= 0 || x.note) row.push(flag, x.note ?? '');
      return row;
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== 'undefined') return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + toB64Url(bytes);
}

export async function decodeList(code: string): Promise<{ name: string; items: WItem[] }> {
  const kind = code[0];
  const raw = fromB64Url(code.slice(1));
  const bytes = kind === 'z' ? await pipe(raw, new DecompressionStream('deflate-raw')) : raw;
  const p = JSON.parse(new TextDecoder().decode(bytes)) as Payload;
  const list = sanitizeList({
    name: p.n,
    items: p.i.map(([base, quote, flag, note]) => ({ base, quote, flag: FLAGS[flag ?? -1], note })),
  });
  if (!list || !list.items.length) throw new Error('invalid share link');
  return list;
}

export async function buildShareUrl(name: string, items: WItem[]): Promise<string> {
  return `${location.origin}${location.pathname}#/s=${await encodeList(name, items)}`;
}

/** Extracts the share code from the current hash, if any. */
export function shareCodeFromHash(hash = location.hash): string | null {
  const m = /^#\/s=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? (m[1] as string) : null;
}
