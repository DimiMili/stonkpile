/**
 * Stonkpile tool definitions, shared by the HTTP MCP endpoint.
 *
 * These read the same index the website renders, so an agent and a human are
 * never looking at different numbers. Kept dependency-free on purpose: the
 * transport in app/api/mcp/route.ts speaks JSON-RPC directly rather than
 * pulling in an MCP server framework.
 */

import { buildIndex, type Index } from "@/lib/pipeline";

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M`
  : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
  : `$${Math.round(v)}`;

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  run: (args: Record<string, unknown>, d: Index) => string;
}

const num = (v: unknown, fallback: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export const TOOLS: Tool[] = [
  {
    name: "market_session",
    title: "US market session",
    description:
      "Whether the US stock market is currently open, and when it next opens or closes. " +
      "Tokenized stocks on Solana keep trading either way.",
    inputSchema: { type: "object", properties: {} },
    run: (_a, d) => {
      const ms = d.marketSession;
      if (!ms) return "Market session state unavailable.";
      const t = (ts?: number) => (ts ? new Date(ts * 1000).toISOString() : "unknown");
      return (
        `US market is ${ms.isOpen ? "OPEN" : "CLOSED"}.\n` +
        `Next open:  ${t(ms.nextOpen)}\nNext close: ${t(ms.nextClose)}\n` +
        `Tokenized equities on Solana trade 24/7 regardless: ` +
        `${d.totals.tradeable} tokens with real liquidity, ` +
        `${usd(d.totals.universeVolume24h)} in 24h volume.`
      );
    },
  },

  {
    name: "list_denominators",
    title: "Stocks used as quote assets",
    description:
      "Tokenized stocks that memecoins are being priced against on Solana, ranked by the " +
      "24h volume of those coins. Covers xStocks, Sunrise, Ondo, PreStocks and Tessera.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20, description: "How many to return" },
        issuer: {
          type: "string",
          enum: ["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"],
          description: "Filter by issuer",
        },
        only_without_247_feed: {
          type: "boolean",
          default: false,
          description: "Only stocks with no always-on Pyth reference price",
        },
      },
    },
    run: (a, d) => {
      let rows = d.stocks.filter((s) => s.quotedCount > 0);
      if (typeof a.issuer === "string") rows = rows.filter((s) => s.issuer === a.issuer);
      if (a.only_without_247_feed === true) rows = rows.filter((s) => !s.has247Feed);
      rows = rows.slice(0, num(a.limit, 20));
      if (!rows.length) return "No denominators match that filter.";
      return rows
        .map(
          (s, i) =>
            `${i + 1}. ${s.symbol} (${s.underlying}, ${s.issuer}) - ${s.quotedCount} coins, ` +
            `${usd(s.quotedVolume24h)} 24h vol, top: ${s.topCoin ?? "n/a"}` +
            `${s.has247Feed ? "" : "  [no 24/7 feed]"}`,
        )
        .join("\n");
    },
  },

  {
    name: "coins_quoted_in",
    title: "Coins priced in a given stock",
    description:
      "Every memecoin quoted against one tokenized stock. Accepts either the token symbol " +
      "(AAPLx, LMT, RIVNon) or the underlying ticker (AAPL, LMT, RIVN).",
    inputSchema: {
      type: "object",
      properties: {
        stock: { type: "string", description: "Token symbol or underlying ticker" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["stock"],
    },
    run: (a, d) => {
      const key = String(a.stock ?? "").toUpperCase();
      const rows = d.coins.filter((c) => c.stock.toUpperCase() === key || c.underlying === key);
      if (!rows.length) {
        const avail = d.stocks.filter((s) => s.quotedCount).map((s) => s.symbol).slice(0, 30);
        return `Nothing is quoted against ${a.stock}.\nStocks in use: ${avail.join(", ")}`;
      }
      const s = d.stocks.find((x) => x.symbol.toUpperCase() === key || x.underlying === key);
      const head = s
        ? `${s.symbol} (${s.underlying}, ${s.issuer}) - ${s.quotedCount} coins, ` +
          `${usd(s.quotedVolume24h)} 24h volume, ${usd(s.quotedLiquidity)} liquidity. ` +
          `${s.has247Feed ? "Has" : "No"} 24/7 Pyth feed.\n\n`
        : "";
      return (
        head +
        rows
          .slice(0, num(a.limit, 20))
          .map(
            (c, i) =>
              `${i + 1}. ${c.coin} - ${usd(c.volume24h)} 24h, ${usd(c.liquidityUsd)} liq, ` +
              `${c.dex}${c.priceChange24h ? `, ${c.priceChange24h > 0 ? "+" : ""}${c.priceChange24h.toFixed(1)}%` : ""}`,
          )
          .join("\n")
      );
    },
  },

  {
    name: "top_coins",
    title: "Top stock-denominated coins",
    description:
      "The largest memecoins by 24h volume across every tokenized stock they are quoted against.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        min_liquidity: { type: "number", minimum: 0, default: 0, description: "Filter out thin pairs" },
      },
    },
    run: (a, d) => {
      const rows = d.coins
        .filter((c) => c.liquidityUsd >= num(a.min_liquidity, 0))
        .slice(0, num(a.limit, 25));
      return (
        `${d.totals.quotedCoins} coins quoted in stocks, ${usd(d.totals.quotedVolume24h)} 24h volume.\n\n` +
        rows
          .map(
            (c, i) =>
              `${i + 1}. ${c.coin} / ${c.stock} - ${usd(c.volume24h)} 24h, ` +
              `${usd(c.liquidityUsd)} liq, ${c.dex}`,
          )
          .join("\n")
      );
    },
  },

  {
    name: "universe_stats",
    title: "Tokenized stock universe",
    description:
      "How many tokenized stocks exist on Solana, how many actually trade, and by which issuer. " +
      "Useful for spotting that most listed tokens have no liquidity at all.",
    inputSchema: { type: "object", properties: {} },
    run: (_a, d) => {
      const T = d.totals;
      return (
        `Tokenized stocks on Solana\n` +
        `  listed:    ${T.universe} (${Object.entries(T.byIssuer).map(([k, v]) => `${k} ${v}`).join(", ")})\n` +
        `  tradeable: ${T.tradeable} above $5k liquidity\n` +
        `  holders:   ${T.universeHolders.toLocaleString()}\n` +
        `  24h vol:   ${usd(T.universeVolume24h)}\n\n` +
        `Used as quote assets: ${T.denominators}\n` +
        `Coins quoted in them: ${T.quotedCoins} (${usd(T.quotedVolume24h)} 24h)\n` +
        `With a 24/7 Pyth reference price: ${T.with247Feed} of ${T.denominators}\n\n` +
        `Snapshot ${d.generatedAt}`
      );
    },
  },

  {
    name: "check_stock",
    title: "Verify a tokenized stock",
    description:
      "Is a given ticker a genuinely issued tokenized stock, or a lookalike? Returns the issuer, " +
      "whether it trades at all, and what is priced against it. Issuers are identified by token " +
      "metadata host, not by name, so a token merely called 'AAPLx' will not pass.",
    inputSchema: {
      type: "object",
      properties: { ticker: { type: "string", description: "Symbol or underlying ticker, e.g. AAPL or AAPLx" } },
      required: ["ticker"],
    },
    run: (a, d) => {
      const key = String(a.ticker ?? "").toUpperCase();
      const hits = d.lookup.filter(
        (l) => l.kind === "stock" && (l.symbol.toUpperCase() === key || l.underlying === key),
      );
      if (!hits.length) {
        return (
          `No verified tokenized stock matches "${a.ticker}".\n` +
          `Nothing with that ticker is issued by xStocks, Sunrise, Ondo, PreStocks or Tessera. ` +
          `If you have seen a token using this name on Solana, it is not one of theirs.`
        );
      }
      return hits
        .map((l) => {
          const row = d.stocks.find((s) => s.symbol === l.symbol);
          const label = l.name ? `${l.symbol} (${l.name})` : l.symbol;
          if (!l.tradeable) {
            return (
              `${label} - genuinely issued by ${l.issuer}, but it does not trade. ` +
              `No pool above the $5k liquidity floor, so there is no price to speak of.\n` +
              `  mint: ${l.mint}`
            );
          }
          return (
            `${label} - issued by ${l.issuer}. Trades.\n` +
            `  mint: ${l.mint}\n` +
            `  liquidity: ${usd(row?.liquidity ?? 0)}, 24h volume: ${usd(row?.volume24h ?? 0)}\n` +
            `  holders: ${(row?.holders ?? 0).toLocaleString()}\n` +
            `  venues: ${row?.venues.join(", ") || "none"}\n` +
            `  coins priced in it: ${l.quotedCount}\n` +
            `  24/7 Pyth reference price: ${row?.has247Feed ? "yes" : "no"}`
          );
        })
        .join("\n\n");
    },
  },

  {
    name: "top_by_liquidity",
    title: "Tokenized stocks ranked by liquidity",
    description:
      "Which tokenized stocks actually have money behind them, ranked by pool liquidity across " +
      "all five issuers. This is the question most tools cannot answer, because they cover one " +
      "issuer. Listing a token costs nothing, so a large catalogue says nothing on its own.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 15 },
        issuer: {
          type: "string",
          enum: ["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"],
          description: "Filter to one issuer",
        },
      },
    },
    run: (a, d) => {
      const depth = d.totals.byIssuerDepth ?? {};
      const total = Object.values(depth).reduce((s2, x) => s2 + x.liquidity, 0);
      let rows = [...d.stocks].sort((x, y) => y.liquidity - x.liquidity);
      if (typeof a.issuer === "string") rows = rows.filter((r) => r.issuer === a.issuer);
      const top10 = rows.slice(0, 10).reduce((s2, r) => s2 + r.liquidity, 0);
      const head =
        `${usd(total)} of liquidity across ${d.totals.universe.toLocaleString()} tokenized stocks.\n` +
        `The ten largest hold ${total ? Math.round((top10 / total) * 100) : 0}% of it.\n\n`;
      return (
        head +
        rows
          .slice(0, num(a.limit, 15))
          .map(
            (r, i) =>
              `${i + 1}. ${r.symbol} (${r.underlying}, ${r.issuer}) - ${usd(r.liquidity)} liquidity, ` +
              `${usd(r.volume24h)} 24h, ${r.holders.toLocaleString()} holders` +
              `${total ? `, ${((r.liquidity / total) * 100).toFixed(1)}% of the category` : ""}`,
          )
          .join("\n")
      );
    },
  },

  {
    name: "identify_mint",
    title: "Identify a contract address",
    description:
      "What is this Solana mint address? Returns whether it is a genuinely issued tokenized " +
      "stock, a coin quoted against one, or neither. A ticker can be copied exactly by a " +
      "lookalike; a mint address cannot, so this is the only check that settles the question.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string", description: "Solana mint address (base58)" } },
      required: ["mint"],
    },
    run: (a, d) => {
      const mint = String(a.mint ?? "").trim();
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
        return `"${mint}" is not a valid Solana mint address. Base58, 32-44 characters, no 0/O/I/l.`;
      }
      const hit = d.lookup.find((l) => l.mint === mint);
      if (!hit) {
        return (
          `${mint}\nNot in this index.\n\n` +
          `It is not a tokenized stock issued by xStocks, Sunrise, Ondo, PreStocks or Tessera, ` +
          `and it is not a coin quoted against one of them. If it presents itself as a ` +
          `tokenized equity, it is not one. Issuers here are identified by token metadata ` +
          `host, so a matching name proves nothing.`
        );
      }
      if (hit.kind === "stock") {
        const row = d.stocks.find((s) => s.mint === mint);
        return (
          `${mint}\n${hit.symbol}${hit.name ? ` (${hit.name})` : ""} - tokenized stock, ` +
          `issued by ${hit.issuer}. Underlying: ${hit.underlying}.\n` +
          (row
            ? `  liquidity: ${usd(row.liquidity)}, 24h volume: ${usd(row.volume24h)}\n` +
              `  holders: ${row.holders.toLocaleString()}\n` +
              `  coins priced in it: ${row.quotedCount}\n` +
              `  24/7 Pyth reference price: ${row.has247Feed ? "yes" : "no"}`
            : `  Does not trade: no pool above the $5k liquidity floor.`)
        );
      }
      const pairs = d.coins.filter((c) => c.coinMint === mint);
      return (
        `${mint}\n${hit.symbol}${hit.name ? ` (${hit.name})` : ""} - a coin quoted against ` +
        `${hit.quotedCount} tokenized stock${hit.quotedCount === 1 ? "" : "s"}, ` +
        `${usd(hit.volume24h ?? 0)} of 24h volume in those pairs.\n` +
        (hit.lookalike
          ? `  WARNING: this is not ${hit.lookalike}. It is a separate token using that exact ` +
            `symbol, issued by nobody. The real ${hit.lookalike} has different metadata and a ` +
            `different mint. Treat this as impersonation.\n`
          : "") +
        (hit.platform
          ? `  NOTE: this is the ${hit.platform}, not an independent memecoin. Its volume is ` +
            `real but it reflects a platform's own activity.\n`
          : "") +
        pairs
          .slice(0, 10)
          .map(
            (c) =>
              `  vs ${c.stock} - ${usd(c.volume24h)} 24h, ${usd(c.liquidityUsd)} liq, ${c.dex}`,
          )
          .join("\n")
      );
    },
  },
];

export async function runTool(name: string, args: Record<string, unknown>) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const d = await buildIndex();
  return tool.run(args ?? {}, d);
}
