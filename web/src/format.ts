export const CHAIN_ORDER = ['ethereum', 'polygon', 'base'] as const;
export const CHAIN_MARK: Record<string, string> = { ethereum: 'ETH', polygon: 'POL', base: 'BASE' };
export const CHAIN_LABEL: Record<string, string> = { ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base' };

const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dollars; sub-cent values keep 2 significant digits so gas never reads as $0.00. */
export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a > 0 && a < 0.01) return `${n < 0 ? '−' : ''}$${a.toPrecision(2)}`;
  return usd2.format(n).replace('-', '−');
}

export function fmtAmount(v: string | number | null | undefined, maxFrac = 6): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxFrac }).format(n);
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function age(iso: string | null | undefined, now: number): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function eta(sec: number | null | undefined): string {
  if (sec == null) return '—';
  return sec < 60 ? `~${sec}s` : `~${Math.round(sec / 60)}m`;
}
