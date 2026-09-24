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

  const idx = await buildIndex();

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
