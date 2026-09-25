/**
 * The safety strip.
 *
 * Every check is computed from data the index already holds. Each one says what
 * it found and what that means, because a coloured dot on its own is noise: the
 * reason people ignore audit badges elsewhere is that they never explain
 * themselves. None of this is advice, it is arithmetic with a sentence attached.
 */
import type { StockRow, QuotedCoin } from "./pipeline";
import { PLATFORM_TOKENS } from "./pipeline";

export { PLATFORM_TOKENS };

export type Level = "good" | "warn" | "bad";

export interface Check {
  id: string;
  label: string;
  level: Level;
  value: string;
  detail: string;
}

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

const days = (ms?: number) => (ms ? (Date.now() - ms) / 86_400_000 : undefined);

/* ---------------- stock tokens ---------------- */

export function stockChecks(s: StockRow): Check[] {
  const out: Check[] = [];

  out.push({
    id: "issuer",
    label: "Issuer",
    level: "good",
    value: s.issuer,
    detail:
      `Metadata is served from ${s.issuer}'s own domain, which is how this index ` +
      `separates real tokenized stocks from the hundreds of lookalikes that simply ` +
      `put the name in their title.`,
  });

  const liq = s.liquidity;
  out.push({
    id: "liquidity",
    label: "Liquidity",
    level: liq >= 500_000 ? "good" : liq >= 50_000 ? "warn" : "bad",
    value: usd(liq),
    detail:
      liq >= 500_000
        ? "Deep enough that a normal trade will not move the price much."
        : liq >= 50_000
        ? "Thin. Larger orders will slip noticeably against you."
        : "Very thin. Expect significant slippage on anything but small orders.",
  });

  out.push({
    id: "oracle",
    label: "Reference price",
    level: s.has247Feed ? "good" : "warn",
    value: s.has247Feed ? "24/7" : "Market hours only",
    detail: s.has247Feed
      ? `Pyth publishes an always-on price for ${s.underlying}, so there is something ` +
        `independent to check the on-chain price against at any hour.`
      : `Pyth only publishes ${s.underlying} during the US session. Once the closing bell ` +
        `goes there is no independent reference price, and that is when on-chain ` +
        `quotes drift furthest from fair value.`,
  });

  const v = s.venues.length;
  out.push({
    id: "venues",
    label: "Venues",
    level: v >= 3 ? "good" : v === 2 ? "warn" : "bad",
    value: v === 0 ? "none" : `${v} DEX${v === 1 ? "" : "es"}`,
    detail:
      v >= 3
        ? "Trades in several places, so one pool drying up is not fatal."
        : v === 2
        ? "Only two venues. Liquidity is concentrated."
        : "A single pool. If it is pulled, there is nowhere else to exit.",
  });

  const h = s.holders;
  out.push({
    id: "holders",
    label: "Holders",
    level: h >= 10_000 ? "good" : h >= 1_000 ? "warn" : "bad",
    value: h.toLocaleString(),
    detail:
      h >= 10_000
        ? "Widely held."
        : h >= 1_000
        ? "Modest holder base for a tokenized equity."
        : "Very few holders. Early, illiquid, or both.",
  });

  return out;
}

/* ---------------- quoted coins ---------------- */

export function coinChecks(c: QuotedCoin): Check[] {
  const out: Check[] = [];

  const platform = c.coinMint ? PLATFORM_TOKENS[c.coinMint] : undefined;
  if (platform) {
    out.push({
      id: "platform",
      label: "Token type",
      level: "warn",
      value: "Platform token",
      detail:
        `${c.coin} is the ${platform}, not an independent coin. Its volume is real but it ` +
        `reflects a platform's own activity rather than demand for a memecoin, so treat it ` +
        `separately when reading the board.`,
    });
  }

  const liq = c.liquidityUsd;
  const turnover = liq > 0 ? c.volume24h / liq : Infinity;
  out.push({
    id: "turnover",
    label: "Turnover",
    level: !isFinite(turnover) ? "bad" : turnover <= 5 ? "good" : turnover <= 20 ? "warn" : "bad",
    value: isFinite(turnover) ? `${turnover.toFixed(1)}x` : "no liquidity",
    detail: !isFinite(turnover)
      ? "Volume is being reported with no pool liquidity behind it. Treat the volume figure as meaningless."
      : turnover <= 5
      ? "Volume is proportionate to the liquidity behind it, which is what organic trading looks like."
      : turnover <= 20
      ? `Each dollar of liquidity is turning over ${turnover.toFixed(0)} times a day. High, but not impossible.`
      : `Each dollar of liquidity is turning over ${turnover.toFixed(0)} times a day. Real demand rarely ` +
        `does this. It usually means incentivised volume or wash trading, so the headline volume ` +
        `number is not telling you what it appears to.`,
  });

  out.push({
    id: "liq",
    label: "Liquidity",
    level: liq >= 100_000 ? "good" : liq >= 10_000 ? "warn" : "bad",
    value: liq > 0 ? usd(liq) : "none reported",
    detail:
      liq >= 100_000
        ? "Enough depth to get in and out at a sane price."
        : liq >= 10_000
        ? "Thin. Small trades only."
        : "Almost no depth. You may not be able to sell what you buy.",
  });

  const age = days(c.createdAt);
  out.push({
    id: "age",
    label: "Pair age",
    level: age === undefined ? "warn" : age >= 30 ? "good" : age >= 7 ? "warn" : "bad",
    value:
      age === undefined
        ? "unknown"
        : age < 1
        ? `${Math.round(age * 24)}h`
        : `${Math.round(age)}d`,
    detail:
      age === undefined
        ? "No creation date reported for this pool."
        : age >= 30
        ? "Has been trading long enough to have a track record."
        : age >= 7
        ? "Still new. Not enough history to judge."
        : "Created in the last week. The overwhelming majority of pools this young go to zero.",
  });

  return out;
}

export const worst = (checks: Check[]): Level =>
  checks.some((c) => c.level === "bad") ? "bad"
  : checks.some((c) => c.level === "warn") ? "warn"
  : "good";
