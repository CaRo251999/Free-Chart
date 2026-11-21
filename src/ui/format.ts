export function fmtPrice(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return n.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, d), maximumFractionDigits: d });
}

export function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function fmtCompact(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 });
}
