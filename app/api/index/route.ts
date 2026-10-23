import { buildIndex, REVALIDATE } from "@/lib/pipeline";

export const revalidate = 300;

/**
 * GET /api/index
 *   ?stock=AAPLx    only that denominator
 *   ?limit=25       cap the coin list
 *   ?slim=1         drop per-stock coin arrays
 * Open CORS: this is the endpoint the MCP server and any agent calls.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const stock = url.searchParams.get("stock");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 1000);
  const slim = url.searchParams.get("slim") === "1";

  /* Never publish an empty index as if it were a reading. Everything
     downstream of this file, including the MCP server and anyone building on
     the JSON, treats a 200 as a fact. */
  let idx;
  try {
    idx = await buildIndex();
  } catch (e) {
    console.error("[stonkpile] /api/index unavailable:", e);
    return Response.json(
      {
        error: "index_unavailable",
        message:
          "The index could not be built from its upstream sources just now. " +
          "No counts are returned rather than zeroed ones. Retry shortly.",
      },
      {
        status: 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }

  let stocks = idx.stocks;
  let coins = idx.coins;

  if (stock) {
    const key = stock.toUpperCase();
    stocks = stocks.filter(
      (s) => s.symbol.toUpperCase() === key || s.underlying === key,
    );
    coins = coins.filter(
      (c) => c.stock.toUpperCase() === key || c.underlying === key,
    );
  }

  const body = {
    ...idx,
    stocks: slim ? stocks.map(({ quotedCoins, ...rest }) => rest) : stocks,
    coins: coins.slice(0, limit),
  };

  return Response.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=600`,
    },
  });
}
