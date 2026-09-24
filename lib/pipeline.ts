/**
 * Stonkpile index.
 * Every tokenized stock on Solana, and every coin quoted against one.
 * Sources: Jupiter (universe + on-chain prices), DexScreener (pairs),
 * Pyth (reference feeds + US market hours). All keyless.
 */

export const REVALIDATE = 300; // seconds

const JUP_VERIFIED = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const DEX_PAIRS = (mint: string) =>
  `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`;
const PYTH_FEEDS = "https://hermes.pyth.network/v2/price_feeds?asset_type=equity";
const PYTH_BENCH = "https://benchmarks.pyth.network/v1/price_feeds";

/** Issuer is identified by metadata host. This is what separates the ~1,400
 *  real tokenized stocks from lookalikes that just put "xStock" in the name. */
const ISSUERS: Record<string, Issuer> = {
  "xstocks-metadata.backed.fi": "xStocks",
  "backpack.exchange": "Backpack",
  "metadata.backpack.exchange": "Backpack",
  "cdn.ondo.finance": "Ondo",
  // PreStocks issues pre-IPO equity: OpenAI, Anthropic, SpaceX, Neuralink.
  // No public company means no Pyth feed, so these are permanently unpriceable
  // against an independent reference. Worth surfacing, not hiding.
  "www.prestocks.com": "PreStocks",
  "prestocks.com": "PreStocks",
  // Tessera tokenizes the same private companies as PreStocks, at different
  // prices, with no oracle to reconcile the two. That gap is worth showing.
  "cdn.tesseralab.co": "Tessera",
};

const NOT_MEME = new Set([
  "USDC", "USDT", "SOL", "WSOL", "CBBTC", "WBTC", "JLP", "XAUT0", "USDG",
  "PYUSD", "USDS", "JITOSOL", "MSOL", "BSOL", "WETH", "ETH", "USD1",
]);

const LIQ_FLOOR = 5_000;

export type Issuer = "xStocks" | "Backpack" | "Ondo" | "PreStocks" | "Tessera";

export interface QuotedCoin {
  coin: string;
  coinMint?: string;
  coinName?: string;
  dex: string;
  url?: string;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  createdAt?: number;
  stock: string;
  underlying: string;
  issuer: Issuer;
}

export interface StockRow {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  issuer: Issuer;
  underlying: string;
  holders: number;
  price: number;
  liquidity: number;
  volume24h: number;
  has247Feed: boolean;
  pythFeedId?: string;
  quotedCount: number;
  quotedLiquidity: number;
  quotedVolume24h: number;
  topCoin?: string;
  quotedCoins: QuotedCoin[];
  venues: string[];
}

export interface LookupEntry {
  symbol: string;
  underlying: string;
  name: string;
  issuer: Issuer;
  icon?: string;
  quotedCount: number;
  tradeable: boolean;
}

export interface Index {
  generatedAt: string;
  marketSession: { isOpen: boolean; nextOpen?: number; nextClose?: number } | null;
  totals: {
    universe: number;
    byIssuer: Record<string, number>;
    tradeable: number;
    universeVolume24h: number;
    universeHolders: number;
    denominators: number;
    quotedCoins: number;
    quotedVolume24h: number;
    quotedLiquidity: number;
    with247Feed: number;
  };
  stocks: StockRow[];
  coins: QuotedCoin[];
  /** Every verified tokenized stock, including the ones that do not trade, so a
   *  lookup can answer "that token is real but nothing trades it" rather than
   *  falling silent. Trimmed hard because this ships to the browser. */
  lookup: LookupEntry[];
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

async function jget<T>(url: string, revalidate = REVALIDATE): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "stonkpile/0.2" },
      next: { revalidate },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function underlying(symbol: string, issuer: Issuer): string {
  const s = (symbol || "").trim();
  if (issuer === "xStocks" && s.endsWith("x")) return s.slice(0, -1).toUpperCase();
  if (issuer === "Ondo" && s.toLowerCase().endsWith("on")) return s.slice(0, -2).toUpperCase();
  // Tessera prefixes with a lowercase t: tOpenAI, tSpaceX, tKalshi.
  if (issuer === "Tessera" && s.startsWith("t")) return s.slice(1).toUpperCase();
  return s.toUpperCase();
}

function host(url?: string): string {
  try {
    return new URL(url || "").host;
  } catch {
    return "";
  }
}

/* ---------------- universe ---------------- */

interface JupToken {
  id: string; name?: string; symbol?: string; icon?: string;
  holderCount?: number; usdPrice?: number; liquidity?: number; mcap?: number;
  stats24h?: { buyVolume?: number; sellVolume?: number };
}

async function buildUniverse() {
  const toks = (await jget<JupToken[]>(JUP_VERIFIED)) || [];
  const uni = [];
  for (const t of toks) {
    const issuer = ISSUERS[host(t.icon)];
    if (!issuer) continue;
    const s = t.stats24h || {};
    uni.push({
      mint: t.id,
      symbol: t.symbol || "?",
      name: t.name || "",
      icon: t.icon,
      issuer,
      underlying: underlying(t.symbol || "", issuer),
      holders: t.holderCount || 0,
      price: n(t.usdPrice),
      liquidity: n(t.liquidity),
      volume24h: n(s.buyVolume) + n(s.sellVolume),
    });
  }
  uni.sort((a, b) => b.volume24h - a.volume24h);
  return uni;
}

/* ---------------- pyth ---------------- */

async function pythLayer(tickers: Set<string>) {
  const feeds =
    (await jget<{ id: string; attributes?: { symbol?: string } }[]>(PYTH_FEEDS, 86400)) || [];

  const byTicker: Record<string, { always_on?: string; session?: string }> = {};
  for (const f of feeds) {
    const parts = (f.attributes?.symbol || "").split(".");
    if (parts.length < 3) continue;
    const tk = parts[2].split("/")[0];
    if (!tickers.has(tk)) continue;
    const kind = parts[1] === "Index" ? "always_on" : "session";
    (byTicker[tk] ||= {})[kind] = f.id;
  }

  // Hermes price updates now require Pyth Pro auth. Market-hours state is
  // still public, and that is what the after-hours view actually needs.
  let session: Index["marketSession"] = null;
  const probe = Object.values(byTicker).find((v) => v.session)?.session;
  if (probe) {
    const b = await jget<{ market_hours?: { is_open?: boolean; next_open?: number; next_close?: number } }>(
      `${PYTH_BENCH}/${probe}`, 600);
    const mh = b?.market_hours;
    if (mh) {
      session = { isOpen: !!mh.is_open, nextOpen: mh.next_open, nextClose: mh.next_close };
    }
  }
  return { byTicker, session };
}

/* ---------------- pairs ---------------- */

interface DexPair {
  dexId?: string; url?: string; pairCreatedAt?: number;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; symbol?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
}

async function scanPairs(
  stock: Awaited<ReturnType<typeof buildUniverse>>[number],
  stockMints: Set<string>,
) {
  const pairs = (await jget<DexPair[]>(DEX_PAIRS(stock.mint))) || [];
  const quoted: QuotedCoin[] = [];
  const venues = new Set<string>();

  for (const p of pairs) {
    const b = p.baseToken || {}, q = p.quoteToken || {};
    if (q.address === stock.mint && b.address !== stock.mint) {
      const sym = b.symbol || "?";
      const isMeme = !NOT_MEME.has(sym.toUpperCase()) && !stockMints.has(b.address || "");
      if (!isMeme) continue;
      quoted.push({
        coin: sym,
        coinMint: b.address,
        coinName: b.name,
        dex: p.dexId || "?",
        url: p.url,
        liquidityUsd: n(p.liquidity?.usd),
        volume24h: n(p.volume?.h24),
        priceChange24h: n(p.priceChange?.h24),
        createdAt: p.pairCreatedAt,
        stock: stock.symbol,
        underlying: stock.underlying,
        issuer: stock.issuer,
      });
    } else if (b.address === stock.mint && p.dexId) {
      venues.add(p.dexId);
    }
  }
  quoted.sort((a, b2) => b2.volume24h - a.volume24h);
  return { quoted, venues: [...venues].sort() };
}

/* ---------------- main ---------------- */

export async function buildIndex(): Promise<Index> {
  const uni = await buildUniverse();
  const stockMints = new Set(uni.map((t) => t.mint));
  const byIssuer: Record<string, number> = {};
  for (const t of uni) byIssuer[t.issuer] = (byIssuer[t.issuer] || 0) + 1;

  const liquid = uni.filter((t) => t.liquidity >= LIQ_FLOOR);
  const { byTicker, session } = await pythLayer(new Set(liquid.map((t) => t.underlying)));

  // modest concurrency keeps us well inside DexScreener's rate limit
  const rows: StockRow[] = [];
  const BATCH = 8;
  for (let i = 0; i < liquid.length; i += BATCH) {
    const slice = liquid.slice(i, i + BATCH);
    const done = await Promise.all(
      slice.map(async (t) => {
        const { quoted, venues } = await scanPairs(t, stockMints);
        const feed = byTicker[t.underlying] || {};
        return {
          ...t,
          has247Feed: !!feed.always_on,
          pythFeedId: feed.always_on || feed.session,
          quotedCoins: quoted,
          quotedCount: quoted.length,
          quotedLiquidity: Math.round(quoted.reduce((s, c) => s + c.liquidityUsd, 0)),
          quotedVolume24h: Math.round(quoted.reduce((s, c) => s + c.volume24h, 0)),
          topCoin: quoted[0]?.coin,
          venues,
        } as StockRow;
      }),
    );
    rows.push(...done);
  }

  rows.sort((a, b) => b.quotedVolume24h - a.quotedVolume24h);
  const coins = rows.flatMap((r) => r.quotedCoins).sort((a, b) => b.volume24h - a.volume24h);

  const byMint = new Map(rows.map((r) => [r.mint, r]));
  const lookup: LookupEntry[] = uni.map((t) => {
    const row = byMint.get(t.mint);
    return {
      symbol: t.symbol,
      underlying: t.underlying,
      name: t.name
        .replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "")
        .trim(),
      issuer: t.issuer,
      // icons are long URLs; only ship them for tokens that actually trade
      ...(row ? { icon: t.icon } : {}),
      quotedCount: row?.quotedCount ?? 0,
      tradeable: !!row,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    marketSession: session,
    totals: {
      universe: uni.length,
      byIssuer,
      tradeable: liquid.length,
      universeVolume24h: Math.round(uni.reduce((s, t) => s + t.volume24h, 0)),
      universeHolders: uni.reduce((s, t) => s + t.holders, 0),
      denominators: rows.filter((r) => r.quotedCount > 0).length,
      quotedCoins: coins.length,
      quotedVolume24h: Math.round(coins.reduce((s, c) => s + c.volume24h, 0)),
      quotedLiquidity: Math.round(coins.reduce((s, c) => s + c.liquidityUsd, 0)),
      with247Feed: rows.filter((r) => r.has247Feed).length,
    },
    stocks: rows,
    coins,
    lookup,
  };
}
