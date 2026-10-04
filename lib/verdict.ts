import type { Index, LookupEntry, StockRow } from "@/lib/pipeline";
import { isRated, type RatingResult } from "@/lib/rating";

/**
 * One mint, one verdict.
 *
 * Everything else here answers questions in English, which is right for a
 * person and for a chat assistant reading the page back to them. It is the
 * wrong shape for an agent that is about to sign a transaction, because that
 * agent has to parse a paragraph to decide, and a paragraph it half-understands
 * becomes a buy.
 *
 * So this returns a decision. The verdict field is a closed set, `clear` is a
 * boolean, and the reasons are tagged codes rather than sentences. An agent can
 * branch on it without a language model in the loop; a person can read it
 * anyway, because the human-readable summary is still there.
 *
 * This deliberately does not say "safe". Nothing here knows whether a price is
 * fair or an issuer is solvent. It answers exactly one question: is this mint
 * the tokenized stock it appears to be. That question has a correct answer and
 * the rest do not.
 */

export type Verdict =
  /** A tokenized stock, issued by a known issuer, metadata host verified. */
  | "issued"
  /** A coin whose market is priced in a tokenized stock. Not itself a stock. */
  | "quoted_coin"
  /** Wearing the exact symbol of a real tokenized stock without being it. */
  | "impostor"
  /** Not in this index at all, so not a tokenized stock and not quoted in one. */
  | "unknown";

export interface MintVerdict {
  mint: string;
  verdict: Verdict;
  /** True only for "issued". The one field an agent should gate a buy on. */
  clear: boolean;
  symbol?: string;
  name?: string;
  issuer?: string;
  underlying?: string;
  /** Present for an issued stock: whether anyone can actually get in or out. */
  hasMarket?: boolean;
  liquidity?: number;
  /** Reference price state: "247", "hours" or "none". */
  feed?: "247" | "hours" | "none";
  /** Perp venues carrying the same company, so a position can be hedged. */
  perpVenues?: string[];
  /** For an impostor: the real token whose symbol it has taken. */
  impersonates?: string;
  /** Present on an issued stock. Either a score with its band and the four
   *  pillars it came from, or a statement that it is not rated and why. The
   *  verdict above is still the only field to gate a buy on: this says how
   *  good the market around it is, not whether the token is what it claims. */
  rating?: RatingResult;
  /** Machine-readable, stable, additive. Branch on these, not on `summary`. */
  reasons: string[];
  /** The same finding in a sentence, for logs and for humans. */
  summary: string;
  asOf: string;
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function verdictFor(mint: string, d: Index): MintVerdict {
  const asOf = d.generatedAt;
  const clean = (mint || "").trim();

  if (!MINT_RE.test(clean)) {
    return {
      mint: clean,
      verdict: "unknown",
      clear: false,
      reasons: ["malformed_mint"],
      summary:
        "Not a valid Solana mint address. Base58, 32 to 44 characters, no 0, O, I or l.",
      asOf,
    };
  }

  const hit: LookupEntry | undefined = d.lookup.find((l) => l.mint === clean);

  if (!hit) {
    return {
      mint: clean,
      verdict: "unknown",
      clear: false,
      reasons: ["not_in_index", "no_verified_issuer"],
      summary:
        "Not in this index. It is not a tokenized stock from any issuer covered here, " +
        "and it is not a coin priced against one. If it presents itself as tokenized " +
        "equity, it is not.",
      asOf,
    };
  }

  if (hit.lookalike) {
    return {
      mint: clean,
      verdict: "impostor",
      clear: false,
      symbol: hit.symbol,
      name: hit.name,
      impersonates: hit.lookalike,
      reasons: ["symbol_collision", "no_verified_issuer"],
      summary:
        `Carries the symbol ${hit.symbol}, which belongs to a genuinely issued tokenized ` +
        `stock, but is a different token with no issuer behind it. Nobody names a coin ` +
        `this by accident.`,
      asOf,
    };
  }

  if (hit.kind === "coin") {
    return {
      mint: clean,
      verdict: "quoted_coin",
      clear: false,
      symbol: hit.symbol,
      name: hit.name,
      underlying: hit.stock,
      reasons: hit.platform ? ["is_quoted_coin", "platform_token"] : ["is_quoted_coin"],
      summary:
        `A coin whose market is priced in ${hit.stock ?? "a tokenized stock"}. It is not ` +
        `itself a tokenized stock and has no issuer.`,
      asOf,
    };
  }

  const row: StockRow | undefined = d.stocks.find((s) => s.mint === clean);
  const reasons = ["issuer_verified_by_metadata_host"];
  if (row && row.liquidity > 0) reasons.push("has_market");
  else reasons.push("no_market");
  if (row?.has247Feed) reasons.push("reference_price_247");
  else if (row?.pythFeedId) reasons.push("reference_price_market_hours");
  else reasons.push("no_reference_price");
  if (row?.perpVenues.length) reasons.push("hedgeable");
  if (row && isRated(row.rating)) reasons.push(`rated_${row.rating.band}`);

  return {
    mint: clean,
    verdict: "issued",
    clear: true,
    symbol: hit.symbol,
    name: hit.name,
    issuer: hit.issuer,
    underlying: hit.underlying,
    hasMarket: !!row && row.liquidity > 0,
    liquidity: row ? Math.round(row.liquidity) : 0,
    feed: row?.has247Feed ? "247" : row?.pythFeedId ? "hours" : "none",
    // names only here: the agent-facing shape stays stable even though the
    // page now carries a URL per venue as well.
    perpVenues: (row?.perpVenues ?? []).map((p) => p.name),
    rating: row?.rating ?? {
      unrated: "no_market",
      reason: "Listed by its issuer with no market behind it. Nothing to measure until somebody funds a pool.",
    },
    reasons,
    summary:
      `${hit.symbol}${hit.name ? ` (${hit.name})` : ""}, a tokenized stock issued by ` +
      `${hit.issuer}, tracking ${hit.underlying}. The issuer is verified from the host ` +
      `serving the token's metadata, not from what the token calls itself.`,
    asOf,
  };
}
