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
  // PreStocks issues pre-IPO equity: OpenAI, Anthropic, Neuralink and the like.
  // No public company means no Pyth feed, so those are unpriceable against an
  // independent reference until the company lists. Worth surfacing, not hiding.
  // Not a blanket rule: its SpaceX token stopped being pre-IPO in June 2026 and
  // now has a Nasdaq price behind it, so do not assume this issuer means private.
  "www.prestocks.com": "PreStocks",
  "prestocks.com": "PreStocks",
  // Tessera tokenizes many of the same companies as PreStocks, at different
  // prices. Where the company is still private there is no oracle to reconcile
  // the two, and where it has since listed there is, which makes the gap a
  // harder question rather than an unanswerable one.
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
  /** Perp venues listing this ticker, with a link straight to that market.
   *  Empty means none found, which for a tokenized stock means buy and hold is
   *  the only thing you can do with it. */
  perpVenues: PerpVenue[];
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
    /** Per issuer, across their WHOLE catalogue rather than only the tokens that
     *  clear the liquidity floor. Counting tokens flatters an issuer who lists
     *  hundreds and funds none of them; the money behind the listings is the
     *  number that says whether a market exists. */
    byIssuerDepth: Record<string, {
      listed: number;
      withPool: number;
      liquidity: number;
      /** liquidity held by everything that does NOT clear the floor */
      strandedLiquidity: number;
      holders: number;
    }>;
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
    /** Tickers with a perp market somewhere, so they can be hedged not just held. */
    withPerp: number;
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

/** POST twin of jget. Hyperliquid's info API is one endpoint that takes a body,
 *  so it cannot go through the GET helper, but it wants the same treatment:
 *  cached, and a failure returns null rather than taking the page down. */
async function jpost<T>(url: string, body: unknown, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Issuers do not agree on tickers, so these fold onto the ticker the reference
 *  market actually uses.
 *
 *  SpaceX is the case that matters. It listed on Nasdaq as SPCX on 12 June 2026,
 *  so it is an ordinary public company with an ordinary Pyth feed, and the three
 *  tokenized versions can be checked against a real price like any other stock.
 *  This used to alias the other way, SPCX onto SPACEX, which is the name the two
 *  pre-IPO issuers minted under and which Pyth has never carried. The effect was
 *  that every SpaceX token showed no feed and the widest cross-issuer gap on the
 *  site sat there looking unverifiable when it was nothing of the sort. */
const TICKER_ALIASES: Record<string, string> = { SPACEX: "SPCX" };

function underlying(symbol: string, issuer: Issuer): string {
  return TICKER_ALIASES[raw(symbol, issuer)] ?? raw(symbol, issuer);
}

function raw(symbol: string, issuer: Issuer): string {
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
    // Symbols look like Equity.US.AAPL/USD, but a ticker can itself contain a
    // dot: Equity.US.HEI.A/USD and Equity.US.BRK.B/USD. Splitting the whole
    // string on "." and taking index 2 silently truncates those to HEI and BRK,
    // which binds a feed to the wrong company. Match the shape instead.
    const m = (f.attributes?.symbol || "").match(/^[A-Za-z]+\.([A-Za-z]+)\.(.+?)\/[A-Z]+$/);
    if (!m) continue;
    const tk = m[2].toUpperCase();
    if (!tickers.has(tk)) continue;
    const kind = m[1] === "Index" ? "always_on" : "session";
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

/* ---------------- perps ---------------- */

export interface PerpVenue {
  name: "Phoenix" | "Hyperliquid";
  /** Straight to that market, not the venue's front page. */
  url: string;
}

/**
 * Which of these companies you can also take a perp position on.
 *
 * A tokenized stock with a perp against it is a different instrument to one
 * without: you can hedge it, short it, and arbitrage the token against the
 * funding rate. A stock with no perp anywhere can only be bought and held. That
 * distinction is not visible anywhere else, because the perp venues and the
 * token issuers do not know about each other.
 *
 * Source is Hyperliquid's builder-deployed perp dexes, which is where equity
 * perps actually live: the main exchange carries 234 markets and not one of
 * them is a stock. Keyless, like everything else here. If the call fails the
 * whole thing degrades to "no perp known", never to an error.
 */
const HL_INFO = "https://api.hyperliquid.xyz/info";
const PHOENIX_MARKETS = "https://perp-api.phoenix.trade/exchange/markets";

/** Hyperliquid's builder dexes, where equity perps live. The main exchange
 *  carries 234 markets and not one of them is a stock. */
async function hyperliquidPerps(): Promise<Map<string, string>> {
  // ticker -> the builder dex carrying it, which the market URL needs
  const out = new Map<string, string>();
  const dexes = (await jpost<({ name?: string } | null)[]>(HL_INFO, { type: "perpDexs" }, 3600)) || [];
  const names = dexes.filter(Boolean).map((d) => d!.name).filter(Boolean) as string[];
  if (!names.length) return out;
  const metas = await Promise.all(
    names.map((dex) =>
      jpost<{ universe?: { name?: string }[] }>(HL_INFO, { type: "meta", dex }, 3600).then(
        (m) => [dex, m?.universe || []] as const,
      ),
    ),
  );
  for (const [dex, universe] of metas) {
    for (const a of universe) {
      // Builder markets are namespaced, "xyz:AAPL": the prefix is the dex and
      // the market URL needs both halves, so keep it rather than stripping it.
      const tk = (a.name || "").replace(/^[a-z0-9]+:/i, "").toUpperCase();
      if (tk && !out.has(tk)) out.set(tk, dex);
    }
  }
  return out;
}

/** Phoenix Perpetuals, the Solana-native venue. Keyless read endpoint. */
async function phoenixPerps(): Promise<Set<string>> {
  const out = new Set<string>();
  const markets =
    (await jget<{ symbol?: string; marketStatus?: string }[]>(PHOENIX_MARKETS, 3600)) || [];
  for (const m of markets) {
    if (m.marketStatus !== "active") continue;
    const tk = (m.symbol || "").toUpperCase();
    if (tk) out.add(tk);
  }
  return out;
}

/**
 * Both venues, because neither covers the other.
 *
 * Measured on 30 Sep 2026 against this board: Phoenix alone misses twenty of
 * them including OpenAI and Anthropic; Hyperliquid alone misses only three, but
 * one of those three is SPY, the single most liquid tokenized stock on Solana.
 * Either source on its own tells a reader the largest thing on the board cannot
 * be hedged, or that the two biggest pre-IPO names cannot. Both can.
 */
async function perpLayer(): Promise<Record<string, PerpVenue[]>> {
  const [hl, phx] = await Promise.all([hyperliquidPerps(), phoenixPerps()]);
  const byTicker: Record<string, PerpVenue[]> = {};
  // Both URL shapes were verified against the live apps rather than guessed.
  // Phoenix puts the market at the root and 404s an unknown ticker, which is
  // the good failure. Hyperliquid needs the dex prefix and quietly falls back
  // to its default market if the pair is wrong, which is the bad one, so the
  // dex is carried through from the meta call rather than assumed.
  for (const tk of phx) {
    (byTicker[tk] ||= []).push({ name: "Phoenix", url: `https://www.phoenix.trade/${tk}` });
  }
  for (const [tk, dex] of hl) {
    (byTicker[tk] ||= []).push({
      name: "Hyperliquid",
      url: `https://app.hyperliquid.xyz/trade/${dex}:${tk}`,
    });
  }
  return byTicker;
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

  const byIssuerDepth: Index["totals"]["byIssuerDepth"] = {};
  for (const t of uni) {
    const d = (byIssuerDepth[t.issuer] ||= {
      listed: 0, withPool: 0, liquidity: 0, strandedLiquidity: 0, holders: 0,
    });
    d.listed++;
    d.liquidity += t.liquidity;
    d.holders += t.holders;
    if (t.liquidity >= LIQ_FLOOR) d.withPool++;
    else d.strandedLiquidity += t.liquidity;
  }
  for (const d of Object.values(byIssuerDepth)) {
    d.liquidity = Math.round(d.liquidity);
    d.strandedLiquidity = Math.round(d.strandedLiquidity);
  }

  const liquid = uni.filter((t) => t.liquidity >= LIQ_FLOOR);
  const [{ byTicker, session }, perps] = await Promise.all([
    pythLayer(new Set(liquid.map((t) => t.underlying))),
    perpLayer(),
  ]);

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
          perpVenues: perps[t.underlying] || [],
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
      byIssuerDepth,
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
      // A tokenized stock you can also hedge is a different instrument to one
      // you can only hold, so this is worth counting on its own.
      withPerp: rows.filter((r) => r.perpVenues.length > 0).length,
    },
    stocks: rows,
    coins,
    lookup,
  };
}
