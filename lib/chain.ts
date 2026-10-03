/**
 * Corporate actions, read off the mint.
 *
 * A tokenized stock whose underlying splits has a problem its issuer has to
 * solve somehow, and the two issuers here solve it in opposite ways. PreStocks
 * use Token-2022's ScaledUiAmount extension, which carries a multiplier and an
 * effective date on the mint itself, so a 5-for-1 is a number anyone can read
 * from the chain. Tessera, by their founder's own account, chose not to re-mint
 * and left their token representing five post-split shares, which is nowhere on
 * chain and only findable by asking him.
 *
 * So this reads the first kind rather than asking anybody, and the second kind
 * stays a short, sourced list below. The point is that the list only ever has to
 * hold the issuers who do not publish, and it shrinks as they adopt the
 * extension rather than growing with every split.
 *
 * Nothing here is load-bearing. The RPC is public and rate-limited and will fail
 * sometimes; when it does, every token simply reports no known corporate action
 * and the rest of the index is unaffected.
 */

const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

export interface CorporateAction {
  /** The multiplier in force right now. 1 means no action, or none yet due. */
  multiplier: number;
  /** When the current multiplier took effect, if it came from a scheduled change. */
  effectiveAt?: string;
  /** A change that is scheduled but has not happened yet. */
  pending?: { multiplier: number; effectiveAt: string };
  /** How we know: the chain, or a figure the issuer gave us. */
  source: "onchain" | "issuer";
}

interface ParsedExt {
  extension?: string;
  state?: {
    multiplier?: string;
    newMultiplier?: string;
    newMultiplierEffectiveTimestamp?: number;
  };
}

/**
 * Issuers who do not encode corporate actions on the mint.
 *
 * One line each, with where the number came from, because an unsourced constant
 * in a file like this is indistinguishable from a guess. Delete an entry the day
 * its issuer starts publishing.
 */
const STATED: Record<string, { multiplier: number; note: string }> = {
  // Tessera's tSpaceX, from Steven (founder) on 2 Oct 2026: SpaceX ran a 5-for-1
  // split before listing and Tessera did not re-mint, so one token is still five
  // post-split shares.
  tSpaceX: { multiplier: 5, note: "stated by the issuer" },
};

const num = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

async function batch(mints: string[]): Promise<Map<string, CorporateAction>> {
  const out = new Map<string, CorporateAction>();
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getMultipleAccounts",
      params: [mints, { encoding: "jsonParsed" }],
    }),
    // The index rebuilds every five minutes; the chain is asked at the same rate.
    next: { revalidate: 300 },
  });
  if (!res.ok) return out;

  const json = await res.json();
  const values: unknown[] = json?.result?.value ?? [];
  const now = Date.now() / 1000;

  values.forEach((v, i) => {
    const exts: ParsedExt[] =
      (v as { data?: { parsed?: { info?: { extensions?: ParsedExt[] } } } })
        ?.data?.parsed?.info?.extensions ?? [];
    const sc = exts.find((e) => e.extension === "scaledUiAmountConfig")?.state;
    if (!sc) return;

    const ts = sc.newMultiplierEffectiveTimestamp;
    const current = num(sc.multiplier);
    const next = num(sc.newMultiplier);

    /* The extension keeps both multipliers so historical balances still resolve.
       Once the effective timestamp passes, the new one is the one in force, and
       reading `multiplier` alone would quietly report a split that already
       happened as not having happened. */
    const due = typeof ts === "number" && ts > 0 && ts <= now;
    const action: CorporateAction = due
      ? { multiplier: next, effectiveAt: new Date(ts * 1000).toISOString(), source: "onchain" }
      : { multiplier: current, source: "onchain" };

    if (!due && typeof ts === "number" && ts > now && next !== current) {
      action.pending = { multiplier: next, effectiveAt: new Date(ts * 1000).toISOString() };
    }

    if (action.multiplier !== 1 || action.pending) out.set(mints[i], action);
  });

  return out;
}

/**
 * Corporate actions for a set of mints, by mint address.
 *
 * getMultipleAccounts takes at most 100 keys per call, and a public RPC will
 * refuse a burst, so these go in sequence rather than in parallel. A batch that
 * fails is skipped rather than failing the whole index.
 */
export async function corporateActions(
  tokens: { mint: string; symbol: string }[],
): Promise<Record<string, CorporateAction>> {
  const out: Record<string, CorporateAction> = {};

  const mints = tokens.map((t) => t.mint);
  for (let i = 0; i < mints.length; i += 100) {
    try {
      const got = await batch(mints.slice(i, i + 100));
      for (const [mint, action] of got) out[mint] = action;
    } catch {
      // a public RPC refusing one batch is not a reason to lose the others
    }
  }

  // Stated figures fill the gaps, and never overwrite something on chain.
  for (const t of tokens) {
    const s = STATED[t.symbol];
    if (s && !out[t.mint]) out[t.mint] = { multiplier: s.multiplier, source: "issuer" };
  }

  return out;
}
