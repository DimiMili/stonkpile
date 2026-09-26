import raw from "@/data/history.json";

/**
 * The daily record, read from data/history.json.
 *
 * Deliberately a static import rather than a filesystem read: the file is
 * bundled at build time, so there is nothing to trace, nothing to deploy
 * separately, and no way for the page to fail because a path moved.
 *
 * Everything here has to survive an empty history, because on day one that is
 * exactly what it is. Nothing in the UI may assume two points exist.
 */
export interface Snapshot {
  date: string;
  at: string;
  liquidity: number;
  universe: number;
  withPool: number;
  denominators: number;
  quotedCoins: number;
  quotedPools?: number;
  quotedVolume24h: number;
  universeVolume24h: number;
  holders: number;
  with247Feed: number;
  byIssuer: Record<string, { listed: number; withPool: number; liquidity: number; holders: number }>;
  top: { symbol: string; issuer: string; liquidity: number; holders: number }[];
  topDenominator: { symbol: string; coins: number } | null;
}

export const history: Snapshot[] = (raw as Snapshot[])
  .filter((r) => r && r.date && Number.isFinite(r.liquidity))
  .sort((a, b) => a.date.localeCompare(b.date));

export const hasHistory = history.length >= 2;

/** One series, oldest first, ready to draw. */
export function series(pick: (s: Snapshot) => number) {
  return history.map((s) => ({ date: s.date, value: pick(s) }));
}

/**
 * Change between the first and last record. Returns null rather than zero when
 * there is nothing to compare, so callers render nothing instead of claiming a
 * flat line that was never measured.
 */
export function change(pick: (s: Snapshot) => number): {
  from: number;
  to: number;
  abs: number;
  pct: number;
  days: number;
} | null {
  if (history.length < 2) return null;
  const from = pick(history[0]);
  const to = pick(history[history.length - 1]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return {
    from,
    to,
    abs: to - from,
    pct: ((to - from) / from) * 100,
    days: history.length,
  };
}

export const since = history[0]?.date ?? null;
