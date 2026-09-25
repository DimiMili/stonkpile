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

/** Platform and treasury tokens: real volume, but not organic demand for a coin.
 *  Keyed by mint so a ticker collision can't produce a false label. Lives here
 *  rather than in lib/checks so the index itself can label them, and so the
 *  lookup can say what a token is without importing the whole checks layer. */
export const PLATFORM_TOKENS: Record<string, string> = {
  "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx": "StonkFun launchpad token",
};

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
  /** Stocks are the issued tokenized equities. Coins are everything quoted
   *  against one. Both are searchable, because somebody holding a coin ticker
   *  or a pasted mint address has no idea which of the two they are looking at. */
  kind: "stock" | "coin";
  symbol: string;
  /** The on-chain mint. This is what makes a contract-address search possible,
   *  and a CA is the only identifier a lookalike cannot fake. */
  mint: string;
  underlying: string;
  name: string;
  issuer?: Issuer;
  icon?: string;
  /** stock: coins priced in it. coin: how many stocks it is priced against. */
  quotedCount: number;
  tradeable: boolean;
  /** coin only: the stock it does most of its volume against, and that volume. */
  stock?: string;
  volume24h?: number;
  /** coin only: set when the mint is a launchpad or treasury token. */
  platform?: string;
  /** coin only: it has taken the exact token symbol of a real tokenized stock
   *  without being that token. Nobody names a coin "AAPLx" by accident. */
  lookalike?: string;
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
    /** Distinct coins. quotedPools is the row count behind it. */
    quotedCoins: number;
    quotedPools: number;
    quotedVolume24h: number;
    quotedLiquidity: number;
    with247Feed: number;
  };
  stocks: StockRow[];
  coins: QuotedCoin[];
  /** Every verified tokenized stock, including the ones that do not trade, so a
   *  lookup can answer "that token is real but nothing trades it" rather than
   *  falling silent, plus every coin quoted against one. Trimmed hard because
   *  this ships to the browser. */
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
          // Distinct coins, not pools. One coin can hold several pools against
          // the same stock (STONK has three against SPYx), and counting rows
          // made the headline "13 coins are priced in SPY" when it was 11.
          quotedCount: new Set(quoted.map((c) => c.coinMint ?? c.coin)).size,
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
    const name = t.name
      .replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "")
      .trim();
    return {
      kind: "stock" as const,
      symbol: t.symbol,
      mint: t.mint,
      underlying: t.underlying,
      // the name is only worth its bytes when it says something the symbol does not
      name: name.toUpperCase() === t.symbol.toUpperCase() ? "" : name,
      issuer: t.issuer,
      // icons are long URLs; only ship them for tokens that actually trade
      ...(row ? { icon: t.icon } : {}),
      quotedCount: row?.quotedCount ?? 0,
      tradeable: !!row,
    };
  });

  /* Coins go in the same lookup. A coin can be quoted against several stocks, so
     collapse by mint: one entry, the stock it does most of its volume against,
     and a count of how many stocks price it. Without this, the 1,000-odd coins on
     the board are invisible to search and a pasted coin address returns nothing. */
  const coinAgg = new Map<
    string,
    { symbol: string; name: string; vol: number; stocks: Set<string>; topStock: string; topVol: number }
  >();
  for (const c of coins) {
    if (!c.coinMint) continue;
    const e = coinAgg.get(c.coinMint) ?? {
      symbol: c.coin,
      name: c.coinName ?? "",
      vol: 0,
      stocks: new Set<string>(),
      topStock: c.stock,
      topVol: -1,
    };
    e.vol += c.volume24h;
    e.stocks.add(c.stock);
    if (c.volume24h > e.topVol) {
      e.topVol = c.volume24h;
      e.topStock = c.stock;
    }
    coinAgg.set(c.coinMint, e);
  }
  /* Real issued token symbols, so a coin wearing one can be named as what it is.
     Two deliberate narrowings, both to keep this from crying wolf:

     Only symbols that carry an issuer's own mark (AAPLx, RIVNon, tSpaceX) count.
     Sunrise names its tokens with the bare ticker, so AMD, IBM and WEN are all
     real token symbols too, and flagging every memecoin called AMD would be
     wrong: naming a coin after a company is ordinary, and there is no way to
     tell an honest one from a fake by the ticker alone.

     And the match is case sensitive, which drops SOON against Ondo's SOon. An
     impersonator copies the casing, because looking right is the entire point. */
  const realSymbols = new Map(
    uni.filter((t) => t.symbol.toUpperCase() !== t.underlying).map((t) => [t.symbol, t.symbol]),
  );

  for (const [mint, e] of coinAgg) {
    const impersonates = realSymbols.get(e.symbol);
    lookup.push({
      kind: "coin",
      ...(impersonates ? { lookalike: impersonates } : {}),
      symbol: e.symbol,
      mint,
      underlying: e.symbol.toUpperCase(),
      name: e.name.toUpperCase() === e.symbol.toUpperCase() ? "" : e.name,
      quotedCount: e.stocks.size,
      tradeable: true,
      stock: e.topStock,
      volume24h: Math.round(e.vol),
      ...(PLATFORM_TOKENS[mint] ? { platform: PLATFORM_TOKENS[mint] } : {}),
    });
  }

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
      // Same correction at the top level: a coin quoted against two stocks, or
      // through two pools, is one coin. The claim on the homepage is about coins.
      quotedCoins: new Set(coins.map((c) => c.coinMint ?? c.coin)).size,
      quotedPools: coins.length,
      quotedVolume24h: Math.round(coins.reduce((s, c) => s + c.volume24h, 0)),
      quotedLiquidity: Math.round(coins.reduce((s, c) => s + c.liquidityUsd, 0)),
      with247Feed: rows.filter((r) => r.has247Feed).length,
    },
    stocks: rows,
    coins,
    lookup,
  };
}
