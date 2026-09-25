import { buildIndex } from "@/lib/pipeline";

export const revalidate = 300;

/**
 * GET /api/lookup
 *
 * The search table on its own. It used to be serialised into the homepage,
 * which was fine while it held 1,600 tickers and no addresses. Adding mints and
 * every quoted coin roughly doubled the page, and most visitors never type
 * anything, so it moved here: the component fetches it the moment the input is
 * touched, and the browser caches it for the life of the snapshot.
 */
export async function GET() {
  const idx = await buildIndex();
  return Response.json(
    { generatedAt: idx.generatedAt, lookup: idx.lookup },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        // Matches the index refresh. stale-while-revalidate means a search after
        // the snapshot turns over is answered instantly from cache and updated
        // behind it, rather than waiting on a rebuild.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
