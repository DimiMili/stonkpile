import { buildIndex } from "@/lib/pipeline";
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
  const idx = await buildIndex();
  const v = verdictFor(decodeURIComponent(mint), idx);

  return Response.json(v, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
