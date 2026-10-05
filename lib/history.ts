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
  byIssuer: Record<string, {
    listed: number;
    withPool: number;
    liquidity: number;
    /** Added 5 Oct 2026. Absent on older records. */
    strandedLiquidity?: number;
    holders: number;
  }>;
  top: { symbol: string; issuer: string; liquidity: number; holders: number }[];
  topDenominator: { symbol: string; coins: number } | null;
  /** Added 5 Oct 2026, so every earlier record is missing it. The counts above
   *  say how many; these say which, and a name is what makes a change postable:
   *  a company getting its first pool, a stock gaining a perp, a grade falling. */
  sets?: {
    listed: string[];
    withPool: string[];
    feed247: string[];
    withPerp: string[];
    denominators: string[];
    grades: Record<string, string>;
  };
}

/**
 * What changed between the two most recent records that both carry sets.
 *
 * Deliberately computed on read rather than stored: a stored diff is a second
 * copy of the truth, and the two disagree the first time a job runs twice in a
 * day or skips one. Returns null until two days of sets exist.
 */
export function movements(): {
  from: string;
  to: string;
  gainedPool: string[];
  lostPool: string[];
  newListings: string[];
  delistings: string[];
  gainedPerp: string[];
  gainedFeed: string[];
  upgrades: { symbol: string; from: string; to: string }[];
  downgrades: { symbol: string; from: string; to: string }[];
} | null {
  const withSets = history.filter((s) => s.sets);
  if (withSets.length < 2) return null;
  const b = withSets[withSets.length - 1];
  const a = withSets[withSets.length - 2];
  const gone = (x: string[], y: string[]) => x.filter((s) => !y.includes(s));

  const order = ["fragile", "thin", "sound", "prime"];
  const upgrades: { symbol: string; from: string; to: string }[] = [];
  const downgrades: { symbol: string; from: string; to: string }[] = [];
  for (const [symbol, to] of Object.entries(b.sets!.grades)) {
    const from = a.sets!.grades[symbol];
    if (!from || from === to) continue;
    (order.indexOf(to) > order.indexOf(from) ? upgrades : downgrades).push({ symbol, from, to });
  }

  return {
    from: a.date,
    to: b.date,
    gainedPool: gone(b.sets!.withPool, a.sets!.withPool),
    lostPool: gone(a.sets!.withPool, b.sets!.withPool),
    newListings: gone(b.sets!.listed, a.sets!.listed),
    delistings: gone(a.sets!.listed, b.sets!.listed),
    gainedPerp: gone(b.sets!.withPerp, a.sets!.withPerp),
    gainedFeed: gone(b.sets!.feed247, a.sets!.feed247),
    upgrades,
    downgrades,
  };
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
