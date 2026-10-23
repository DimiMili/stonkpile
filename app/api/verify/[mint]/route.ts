import { buildIndex, IndexUnavailable } from "@/lib/pipeline";
import { verdictFor } from "@/lib/verdict";

export const revalidate = 300;

/**
 * GET /api/verify/{mint}
 *
 * The call an agent makes immediately before it spends money.
 *
 * Every other endpoint here describes the market. This one returns a decision:
 * a closed-set verdict, a boolean, and tagged reason codes, so a caller can
 * branch on it without reading English. Open CORS and no key, because a check
 * that costs something is a check people skip.
 *
 * 200 on every well-formed request, including "unknown" and "impostor". Those
 * are answers, not errors, and an agent that treats a 404 as a transport
 * failure would retry its way into exactly the buy this is meant to prevent.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;

  /* The one case where 200 would be a lie. If the index cannot be built, this
     endpoint does not know anything about this mint, and "unknown" is reserved
     for mints it has looked for and not found. Saying that about a real token
     is the single worst thing this site can do, so say nothing instead, with a
     status an agent will treat as a transport failure and retry. `clear` stays
     false either way: no index, no buy. */
  let idx;
  try {
    idx = await buildIndex();
  } catch (e) {
    const detail = e instanceof IndexUnavailable ? e.message : "index build failed";
    console.error("[stonkpile] /api/verify unavailable:", e);
    return Response.json(
      {
        mint: decodeURIComponent(mint),
        verdict: "unavailable",
        clear: false,
        reasons: ["index_unavailable"],
        summary:
          "The index could not be read just now, so this mint has not been checked. " +
          "This is not a statement about the token. Retry shortly.",
        detail,
        asOf: new Date().toISOString(),
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

  const v = verdictFor(decodeURIComponent(mint), idx);

  return Response.json(v, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
