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
      "24h volume of those coins. Covers xStocks, Backpack, Ondo, PreStocks and Tessera.",
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
      const hits = d.lookup.filter((l) => l.symbol.toUpperCase() === key || l.underlying === key);
      if (!hits.length) {
        return (
          `No verified tokenized stock matches "${a.ticker}".\n` +
          `Nothing with that ticker is issued by xStocks, Backpack, Ondo, PreStocks or Tessera. ` +
          `If you have seen a token using this name on Solana, it is not one of theirs.`
        );
      }
      return hits
        .map((l) => {
          const row = d.stocks.find((s) => s.symbol === l.symbol);
          if (!l.tradeable) {
            return (
              `${l.symbol} (${l.name}) - genuinely issued by ${l.issuer}, but it does not trade. ` +
              `No pool above the $5k liquidity floor, so there is no price to speak of.`
            );
          }
          return (
            `${l.symbol} (${l.name}) - issued by ${l.issuer}. Trades.\n` +
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
];

export async function runTool(name: string, args: Record<string, unknown>) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const d = await buildIndex();
  return tool.run(args ?? {}, d);
}
