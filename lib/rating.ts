/**
 * The rating.
 *
 * Everything else on this site reports. This is the one place that forms an
 * opinion, so it is written to be argued with: every point is traceable to a
 * number the site already shows, the weights are constants at the top of this
 * file rather than buried in the arithmetic, and the whole thing runs on public
 * inputs that anybody can fetch and recompute.
 *
 * What it answers: if you buy this token today, how well can you price it, hold
 * it and get back out of it. That is a question about the market around a
 * token, not about the company behind it and not about whether the price is
 * fair. It does not know whether the issuer is solvent, it cannot read a
 * prospectus, and it will never tell anybody to buy anything.
 *
 * Two deliberate gates come before any score:
 *
 *  - A token that fails the issuer check is not rated at all. Giving an
 *    impostor a low score implies it sits on the same ladder as a real one,
 *    and it does not. It is a different kind of thing, and the verdict layer
 *    already says so.
 *  - A verified token with no market is not rated either. There is nothing to
 *    measure: no depth, no turnover, no venues. It is listed, and that is the
 *    whole fact. Scoring it 3 out of 100 would read as a judgment on the
 *    company rather than on the absence of a pool.
 *
 * Not rating these is the honest answer and also the useful one, because
 * "unrated, listed only" is exactly the state most of the 1,800 listings are in
 * and nobody else reports it.
 *
 * What is NOT in here, and why:
 *
 *  - Deviation from a live reference price. It belongs in a rating and it is
 *    the first thing to add. Pyth's Hermes price updates now require Pyth Pro
 *    auth, so this site cannot read a live reference price without a key, and
 *    everything here is keyless on purpose. What can be done without a key is
 *    comparing issuers against each other on the same company, per underlying
 *    share, which is the corroboration pillar below.
 *  - Anything about the memecoins quoted against these stocks. They are a
 *    different question with a different method and they do not belong on this
 *    scale. A pool's quality is not an instrument's rating.
 *  - Holder counts. A big holder count on a token with one thin pool describes
 *    an airdrop, not a market, and it is trivially inflated.
 */

import type { StockRow } from "@/lib/pipeline";

/* ---------------- the weights ---------------- */

/** Depth is the largest single pillar because it is the one that decides
 *  whether you can leave. Everything else is a refinement on top of it. */
const W_DEPTH = 40;
/** Whether the pool is being used, and used by people rather than by a loop. */
const W_USE = 25;
/** How many ways out exist: pools, venues, and a perp to hedge against. */
const W_EXIT = 20;
/** Whether the thing can be priced when the US market is shut, and whether a
 *  second issuer's price on the same company agrees with this one. */
const W_PRICE = 15;

/** Depth scale. Zero points at the liquidity floor, full marks at $10M, log
 *  spaced because the difference between $20k and $200k matters far more to
 *  somebody getting out than the difference between $5M and $10M. */
const DEPTH_FLOOR = 5_000;
const DEPTH_FULL = 10_000_000;

/** Turnover is volume against the pool's own contents, per day.
 *  Below DEAD the pool exists and nobody is using it. Between LIVE_LOW and
 *  LIVE_HIGH is what ordinary two-way trading looks like across this index,
 *  where the median pool turns over about half its contents a day. Above
 *  WASH_START the same money is going round in circles, and by WASH_FULL it is
 *  the dominant explanation. These are read off the real distribution, not
 *  picked for roundness. */
const DEAD = 0.01;
const LIVE_LOW = 0.05;
const LIVE_HIGH = 5;
const WASH_START = 10;
const WASH_FULL = 25;

export type Band = "prime" | "sound" | "thin" | "fragile";

/** Why a token has no score. Both are statements about the market, not slurs. */
export type Unrated = "unverified" | "no_market";

export interface Pillar {
  key: "depth" | "use" | "exit" | "price";
  label: string;
  /** This part on its own, 0 to 10, so four parts with four different weights
   *  can be compared without arithmetic. Nobody reads 36.1 out of 40 against
   *  11.5 out of 15 and forms a view; everybody reads 9.0 against 7.7. */
  score: number;
  /** What that 0 to 10 is worth in the total. Ten across all four is exactly
   *  100, so the composite stays reconstructable by hand. */
  weight: number;
  /** Still carried, because the weighted contribution is what makes the total
   *  add up and an API consumer should not have to multiply to check us. */
  points: number;
  max: number;
  /** The figure the points came from, in the words the site uses elsewhere. */
  detail: string;
}

export interface Rating {
  score: number;
  band: Band;
  pillars: Pillar[];
  /** Short, plain statements worth seeing without opening the breakdown. */
  flags: string[];
}

export interface NotRated {
  unrated: Unrated;
  reason: string;
}

export type RatingResult = Rating | NotRated;

export const isRated = (r: RatingResult | undefined): r is Rating =>
  !!r && "score" in r;

/**
 * The rating scale.
 *
 * Letters, because there is no standard for scoring a token market and the one
 * convention everybody already reads is the credit scale: a letter you grasp in
 * a glance, a word for what it means, and a sentence for why. "Band" was our
 * word for this and nobody else's, so it is gone.
 */
export const BANDS: { band: Band; letter: string; min: number; label: string; blurb: string }[] = [
  { band: "prime", letter: "A", min: 80, label: "Prime", blurb: "deep, traded, priceable, more than one way out" },
  { band: "sound", letter: "B", min: 62, label: "Sound", blurb: "a real market missing one or two things" },
  { band: "thin", letter: "C", min: 42, label: "Thin", blurb: "fine in small size, not much more" },
  { band: "fragile", letter: "D", min: 0, label: "Fragile", blurb: "one pool, barely traded, or volume that is not real" },
];

export const bandOf = (score: number): Band =>
  (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).band;

export const bandLabel = (band: Band): string =>
  BANDS.find((b) => b.band === band)?.label ?? "Unrated";

export const bandLetter = (band: Band): string =>
  BANDS.find((b) => b.band === band)?.letter ?? "\u2014";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round = (x: number) => Math.round(x * 10) / 10;

const money = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${Math.round(v / 1_000)}k` : `$${Math.round(v)}`;

/* ---------------- the pillars ---------------- */

function depthPoints(liquidity: number): number {
  if (liquidity <= DEPTH_FLOOR) return 0;
  const span = Math.log10(DEPTH_FULL / DEPTH_FLOOR);
  return W_DEPTH * clamp01(Math.log10(liquidity / DEPTH_FLOOR) / span);
}

/**
 * Use, scored as a band rather than as "more is better".
 *
 * A pool doing nothing and a pool doing eighty times its own size in a day are
 * both failures, and a scale that rewards volume rewards the second one. This
 * rises to full marks across ordinary trading and falls away again once the
 * volume stops being explicable by the money in the pool.
 */
function usePoints(turnover: number): number {
  if (turnover <= DEAD) return 0;
  if (turnover < LIVE_LOW) {
    return W_USE * 0.35 * ((turnover - DEAD) / (LIVE_LOW - DEAD));
  }
  if (turnover <= LIVE_HIGH) return W_USE;
  if (turnover <= WASH_START) {
    // a slope, not a cliff: 5x to 10x is busy, not necessarily fake
    return W_USE * (1 - 0.3 * ((turnover - LIVE_HIGH) / (WASH_START - LIVE_HIGH)));
  }
  if (turnover >= WASH_FULL) return 0;
  return W_USE * 0.7 * (1 - (turnover - WASH_START) / (WASH_FULL - WASH_START));
}

function exitPoints(venues: number, perps: number): { points: number; detail: string } {
  // Venues first: one pool is a single point of failure whatever its size.
  const vp = venues >= 3 ? 14 : venues === 2 ? 11 : venues === 1 ? 6 : 0;
  const pp = perps > 0 ? 6 : 0;
  const parts = [
    venues === 0 ? "no pool" : venues === 1 ? "one venue" : `${venues} venues`,
    perps > 0 ? (perps === 1 ? "a perp to hedge with" : `${perps} perp markets`) : "no perp",
  ];
  return { points: vp + pp, detail: parts.join(", ") };
}

/**
 * Price integrity, without a price feed we are allowed to read.
 *
 * Two independent halves. A 24/7 reference feed means the token can be priced
 * when the US market is shut, which is most of the week. Corroboration means a
 * second issuer lists the same company and, compared per underlying share,
 * agrees. Where no second issuer exists there is nothing to corroborate, so
 * that half scores at its midpoint and the flag says why rather than the score
 * quietly punishing a token for being the only one of its kind.
 */
function pricePoints(
  has247: boolean,
  gap: number | null,
): { points: number; detail: string } {
  const feed = has247 ? 8 : 0;
  let corr: number;
  let how: string;
  if (gap === null) {
    corr = 3.5;
    how = "no second issuer to check against";
  } else if (gap <= 0.01) {
    corr = 7;
    how = "another issuer agrees within 1%";
  } else if (gap <= 0.03) {
    corr = 5;
    how = `another issuer is ${(gap * 100).toFixed(1)}% away`;
  } else if (gap <= 0.1) {
    corr = 2.5;
    how = `another issuer is ${(gap * 100).toFixed(0)}% away`;
  } else {
    corr = 0;
    how = `another issuer is ${(gap * 100).toFixed(0)}% away`;
  }
  return {
    points: feed + corr,
    detail: `${has247 ? "priced around the clock" : "no price after the closing bell"}, ${how}`,
  };
}

/* ---------------- the rating ---------------- */

/**
 * @param row       the stock, as the index built it
 * @param peerGap   smallest relative per-share price difference against another
 *                  issuer listing the same company, or null where none exists
 * @param verified  whether the issuer check passed. Computed upstream, because
 *                  this module should not know how the check is done, only
 *                  whether it passed.
 */
export function rate(
  row: StockRow,
  peerGap: number | null,
  verified = true,
): RatingResult {
  if (!verified) {
    return {
      unrated: "unverified",
      reason: "Not issued by a verified issuer, so there is nothing here to rate.",
    };
  }
  if (!row.liquidity || row.liquidity < DEPTH_FLOOR) {
    return {
      unrated: "no_market",
      reason: "Listed by its issuer with no market behind it. Nothing to measure until somebody funds a pool.",
    };
  }

  const turnover = row.liquidity > 0 ? row.volume24h / row.liquidity : 0;
  const venues = row.venues?.length ?? 0;
  const perps = row.perpVenues?.length ?? 0;

  const depth = depthPoints(row.liquidity);
  const use = usePoints(turnover);
  const exit = exitPoints(venues, perps);
  const price = pricePoints(row.has247Feed, peerGap);

  /* One hard cap, and only one.
     A market cannot be Prime while another issuer prices the same company
     double digits away per share. Depth, turnover and venues can all look
     excellent and the thing you are buying still has a disputed price, which
     is the one failure a weighted average hides: it was worth 7 points out of
     100 and it is the whole question. Capped rather than zeroed, because the
     disagreement does not make the pool shallower or the exits fewer. */
  const disputed = peerGap !== null && peerGap > 0.1;
  const raw = depth + use + exit.points + price.points;
  const score = Math.round(disputed ? Math.min(raw, BANDS[0].min - 1) : raw);

  const mk = (points: number, max: number) => ({
    score: round((points / max) * 10),
    weight: max / 10,
    points: round(points),
    max,
  });

  const pillars: Pillar[] = [
    {
      key: "depth",
      label: "Liquidity",
      ...mk(depth, W_DEPTH),
      detail: `${money(row.liquidity)} in the pool`,
    },
    {
      key: "use",
      label: "Real volume",
      ...mk(use, W_USE),
      detail: `turns over ${turnover < 0.1 ? turnover.toFixed(2) : turnover.toFixed(1)}x its own size a day`,
    },
    {
      key: "exit",
      label: "Exits",
      ...mk(exit.points, W_EXIT),
      detail: exit.detail,
    },
    {
      key: "price",
      label: "Pricing",
      ...mk(price.points, W_PRICE),
      detail: price.detail,
    },
  ];

  const flags: string[] = [];
  if (venues === 1) flags.push("One pool. If it empties, the exit empties with it.");
  if (turnover >= WASH_START) {
    flags.push(`Volume is ${Math.round(turnover)} times the pool. That is the same money going round, not demand.`);
  }
  if (turnover <= DEAD) flags.push("Nothing traded in the last day.");
  if (!row.has247Feed) flags.push("No reference price once the US market shuts.");
  if (perps === 0) flags.push("No perp market, so it can be held but not hedged.");
  if (disputed) {
    flags.push(
      `Another issuer prices the same company ${Math.round(peerGap! * 100)}% away, per share. ` +
        `Held below Prime for that reason alone.`,
    );
  }

  return { score, band: bandOf(score), pillars, flags };
}

/**
 * Smallest per-share price gap between each stock and any other issuer's token
 * on the same company, keyed by mint.
 *
 * Per share, not per token: an issuer whose token is five underlying shares is
 * not disagreeing with one whose token is one share, and treating that as a
 * disagreement is how a unit mismatch gets dressed up as an accusation. Only
 * tokens with a market are compared, since a price nobody can trade at is not
 * a second opinion.
 */
export function peerGaps(rows: StockRow[]): Record<string, number | null> {
  const byCompany = new Map<string, StockRow[]>();
  for (const r of rows) {
    if (!r.price || r.liquidity < DEPTH_FLOOR) continue;
    const key = r.underlying.toUpperCase();
    byCompany.set(key, [...(byCompany.get(key) ?? []), r]);
  }
  const out: Record<string, number | null> = {};
  for (const r of rows) {
    const peers = byCompany.get(r.underlying.toUpperCase()) ?? [];
    const mine = r.price / (r.sharesPerToken > 0 ? r.sharesPerToken : 1);
    let best: number | null = null;
    for (const p of peers) {
      if (p.mint === r.mint || p.issuer === r.issuer || !mine) continue;
      const theirs = p.price / (p.sharesPerToken > 0 ? p.sharesPerToken : 1);
      if (!theirs) continue;
      const gap = Math.abs(mine - theirs) / ((mine + theirs) / 2);
      if (best === null || gap < best) best = gap;
    }
    out[r.mint] = best;
  }
  return out;
}
