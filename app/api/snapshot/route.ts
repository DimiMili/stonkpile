import { buildIndex } from "@/lib/pipeline";

/**
 * Never cached, unlike every other route here.
 *
 * This endpoint is read once a day by the snapshot job and by nothing else,
 * which is exactly what made caching it dangerous. With ISR the first request
 * after a quiet period is served the stale entry and only kicks off a rebuild
 * behind it, so the job, always being the first caller of the day, reliably
 * received yesterday's numbers. Measured on 29 Sep 2026: a request at 21:55 UTC
 * returned a payload generated at 10:42, and the request right after it came
 * back current. A cache-busting query string does not help, because the search
 * string is not part of the cache key here.
 *
 * One uncached render a day costs nothing and is the only way this file is
 * honest about when it was taken.
 */
export const revalidate = 0;
export const dynamic = "force-dynamic";

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
export async function GET(req: Request) {
  /* The only uncached route here, and the most expensive one.
     Every request rebuilds the whole index: parsing a seven-megabyte Jupiter
     payload, walking eighteen hundred mints and assembling the maps. The
     upstream calls themselves are safe, because jget pins next.revalidate on
     each fetch and that survives force-dynamic, so a flood here does not get us
     rate-limited by Jupiter or DexScreener. What it does spend is serverless
     CPU and function concurrency, both of which are billed and both of which
     run out.

     It is read once a day by one GitHub Action and by nothing else, so a shared
     secret costs that job one header and closes it. With no secret configured
     the route stays open, so an unconfigured deploy keeps working rather than
     silently losing its history. */
  const expected = process.env.SNAPSHOT_TOKEN;
  if (expected) {
    const url = new URL(req.url);
    const given =
      req.headers.get("x-snapshot-token") ?? url.searchParams.get("token") ?? "";
    if (given !== expected) {
      return new Response("Not found", { status: 404 });
    }
  }

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
      // The CDN must not hold this either, for the reason above.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
