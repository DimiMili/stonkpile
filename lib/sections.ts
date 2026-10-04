/**
 * The derivations behind the sections that get shared.
 *
 * These lived inside app/page.tsx, which was fine while the home page was the
 * only thing rendering them. It stopped being fine the moment each section got
 * its own URL: two copies of "what counts as accrual" drift, and the version on
 * the page somebody shares is the one that ends up wrong.
 *
 * So the rule here is one definition per question, imported by both the home
 * page and the section page.
 */

import type { Index, StockRow } from "@/lib/pipeline";
import { isRated, type Rating } from "@/lib/rating";
import type { ChurnPoint } from "@/components/Churn";

/** Every pool with both numbers, stocks and quoted coins in one cloud.
 *  The $1k floor on each axis keeps dust out: a pool holding eleven dollars
 *  says nothing about whether its volume is real. */
export function churnPoints(idx: Index): ChurnPoint[] {
  return [
    ...idx.stocks
      .filter((s) => s.liquidity >= 1000 && s.volume24h >= 1000)
      .map((s) => ({
        label: s.symbol, sub: s.issuer, liquidity: s.liquidity,
        volume: s.volume24h, kind: "stock" as const,
      })),
    ...idx.coins
      .filter((c) => c.liquidityUsd >= 1000 && c.volume24h >= 1000)
      .map((c) => ({
        label: c.coin, sub: `in ${c.stock}`, liquidity: c.liquidityUsd,
        volume: c.volume24h, kind: "coin" as const,
      })),
  ];
}

/* Tokens whose balance has grown.
   A ScaledUiAmount multiplier above 1 means a holder's balance is larger than
   the number of tokens they bought. Two different things produce that and they
   should not share a table: a split is a big clean ratio and changes nothing
   about what you own, while a small accrual is the issuer passing something
   through. The cut at 1.25 separates them without having to guess which is
   which from the name. */
export function accrualRows(stocks: StockRow[]): StockRow[] {
  return stocks
    .filter((r) => r.action && r.action.multiplier > 1.00005 && r.action.multiplier < 1.25)
    .sort((a, b) => b.action!.multiplier - a.action!.multiplier);
}

export function splitRows(stocks: StockRow[]): StockRow[] {
  return stocks.filter((r) => r.action && r.action.multiplier >= 1.25);
}

/** Rated stocks, best first. Only the ones with a market are rated at all. */
export function ratedRows(stocks: StockRow[]): { row: StockRow; rating: Rating }[] {
  return stocks
    .filter((r) => isRated(r.rating))
    .map((r) => ({ row: r, rating: r.rating as Rating }))
    .sort((a, b) => b.rating.score - a.rating.score);
}
