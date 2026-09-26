import { buildIndex } from "@/lib/pipeline";

export const revalidate = 300;

/**
 * GET /api/snapshot
 *
 * One day of this index, trimmed to the things worth keeping forever. A daily
 * job fetches this and appends it to data/history.json in the repo, which is
 * the whole storage layer: no database, no keys, and the history is public and
 * auditable because it sits in git next to the code that produced it.
 *
 * Kept deliberately small. Every field here costs a few hundred bytes a year,
 * and the point of a snapshot is the shape of the category over time, not a
 * frozen copy of every row.
 */
export async function GET() {
  const idx = await buildIndex();
  const T = idx.totals;

  const liquidity = Object.values(T.byIssuerDepth).reduce((a, d) => a + d.liquidity, 0);
  const byLiq = [...idx.stocks].sort((a, b) => b.liquidity - a.liquidity);
  const topDenominator = [...idx.stocks].sort((a, b) => b.quotedCount - a.quotedCount)[0];

  const record = {
    date: idx.generatedAt.slice(0, 10),
    at: idx.generatedAt,

    // the category, in one line each
    liquidity: Math.round(liquidity),
    universe: T.universe,
    withPool: T.tradeable,
    denominators: T.denominators,
    quotedCoins: T.quotedCoins,
    quotedPools: T.quotedPools,
    quotedVolume24h: T.quotedVolume24h,
    universeVolume24h: T.universeVolume24h,
    holders: T.universeHolders,
    with247Feed: T.with247Feed,

    byIssuer: Object.fromEntries(
      Object.entries(T.byIssuerDepth).map(([k, d]) => [
        k,
        { listed: d.listed, withPool: d.withPool, liquidity: d.liquidity, holders: d.holders },
      ]),
    ),

    // the ten that matter, so concentration can be recomputed later
    top: byLiq.slice(0, 10).map((r) => ({
      symbol: r.symbol,
      issuer: r.issuer,
      liquidity: Math.round(r.liquidity),
      holders: r.holders,
    })),

    topDenominator: topDenominator
      ? { symbol: topDenominator.symbol, coins: topDenominator.quotedCount }
      : null,
  };

  return Response.json(record, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
