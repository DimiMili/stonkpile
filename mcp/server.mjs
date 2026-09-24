#!/usr/bin/env node
/**
 * Stonkpile MCP server.
 * Gives an agent the one thing it cannot web-search: which memecoins are
 * quoted against which tokenized stocks on Solana, right now.
 *
 *   claude_desktop_config.json / .cursor/mcp.json
 *   { "mcpServers": { "stonkpile": { "command": "node",
 *       "args": ["/abs/path/mcp/server.mjs"],
 *       "env": { "STONKPILE_API": "https://<your-deploy>/api/index" } } } }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.STONKPILE_API || "http://localhost:3000/api/index";

let cache = { at: 0, data: null };
async function index() {
  if (cache.data && Date.now() - cache.at < 120_000) return cache.data;
  const r = await fetch(API, { headers: { "User-Agent": "stonkpile-mcp/0.1" } });
  if (!r.ok) throw new Error(`index unavailable: HTTP ${r.status}`);
  cache = { at: Date.now(), data: await r.json() };
  return cache.data;
}

const usd = (v) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

const text = (s) => ({ content: [{ type: "text", text: s }] });

const server = new McpServer({ name: "stonkpile", version: "0.1.0" });

server.registerTool(
  "market_session",
  {
    title: "US market session",
    description:
      "Whether the US stock market is currently open, and when it next opens or closes. " +
      "Tokenized stocks on Solana keep trading either way.",
    inputSchema: {},
  },
  async () => {
    const d = await index();
    const ms = d.marketSession;
    if (!ms) return text("Market session state unavailable.");
    const t = (ts) => (ts ? new Date(ts * 1000).toISOString() : "unknown");
    return text(
      `US market is ${ms.isOpen ? "OPEN" : "CLOSED"}.\n` +
        `Next open:  ${t(ms.nextOpen)}\nNext close: ${t(ms.nextClose)}\n` +
        `Tokenized equities on Solana trade 24/7 regardless: ` +
        `${d.totals.tradeable} tokens with real liquidity, ` +
        `${usd(d.totals.universeVolume24h)} in 24h volume.`,
    );
  },
);

server.registerTool(
  "list_denominators",
  {
    title: "Stocks used as quote assets",
    description:
      "Tokenized stocks that memecoins are being priced against on Solana, ranked by the " +
      "24h volume of those coins. Covers xStocks, Backpack and Ondo.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(20).describe("How many to return"),
      issuer: z.enum(["xStocks", "Backpack", "Ondo"]).optional().describe("Filter by issuer"),
      only_without_247_feed: z.boolean().default(false)
        .describe("Only stocks with no always-on Pyth reference price"),
    },
  },
  async ({ limit, issuer, only_without_247_feed }) => {
    const d = await index();
    let rows = d.stocks.filter((s) => s.quotedCount > 0);
    if (issuer) rows = rows.filter((s) => s.issuer === issuer);
    if (only_without_247_feed) rows = rows.filter((s) => !s.has247Feed);
    rows = rows.slice(0, limit);
    if (!rows.length) return text("No denominators match that filter.");
    return text(
      rows
        .map(
          (s, i) =>
            `${i + 1}. ${s.symbol} (${s.underlying}, ${s.issuer}) — ${s.quotedCount} coins, ` +
            `${usd(s.quotedVolume24h)} 24h vol, top: ${s.topCoin ?? "n/a"}` +
            `${s.has247Feed ? "" : "  [no 24/7 feed]"}`,
        )
        .join("\n"),
    );
  },
);

server.registerTool(
  "coins_quoted_in",
  {
    title: "Coins priced in a given stock",
    description:
      "Every memecoin quoted against one tokenized stock. Accepts either the token symbol " +
      "(AAPLx, LMT, RIVNon) or the underlying ticker (AAPL, LMT, RIVN).",
    inputSchema: {
      stock: z.string().describe("Token symbol or underlying ticker"),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async ({ stock, limit }) => {
    const d = await index();
    const key = stock.toUpperCase();
    const rows = d.coins.filter(
      (c) => c.stock.toUpperCase() === key || c.underlying === key,
    );
    if (!rows.length) {
      const avail = d.stocks.filter((s) => s.quotedCount).map((s) => s.symbol).slice(0, 30);
      return text(`Nothing is quoted against ${stock}.\nStocks in use: ${avail.join(", ")}`);
    }
    const s = d.stocks.find((x) => x.symbol.toUpperCase() === key || x.underlying === key);
    const head = s
      ? `${s.symbol} (${s.underlying}, ${s.issuer}) — ${s.quotedCount} coins, ` +
        `${usd(s.quotedVolume24h)} 24h volume, ${usd(s.quotedLiquidity)} liquidity. ` +
        `${s.has247Feed ? "Has" : "No"} 24/7 Pyth feed.\n\n`
      : "";
    return text(
      head +
        rows
          .slice(0, limit)
          .map(
            (c, i) =>
              `${i + 1}. ${c.coin} — ${usd(c.volume24h)} 24h, ${usd(c.liquidityUsd)} liq, ` +
              `${c.dex}${c.priceChange24h ? `, ${c.priceChange24h > 0 ? "+" : ""}${c.priceChange24h.toFixed(1)}%` : ""}`,
          )
          .join("\n"),
    );
  },
);

server.registerTool(
  "top_coins",
  {
    title: "Top stock-denominated coins",
    description:
      "The largest memecoins by 24h volume across every tokenized stock they are quoted against.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(25),
      min_liquidity: z.number().min(0).default(0).describe("Filter out thin pairs"),
    },
  },
  async ({ limit, min_liquidity }) => {
    const d = await index();
    const rows = d.coins.filter((c) => c.liquidityUsd >= min_liquidity).slice(0, limit);
    return text(
      `${d.totals.quotedCoins} coins quoted in stocks, ${usd(d.totals.quotedVolume24h)} 24h volume.\n\n` +
        rows
          .map(
            (c, i) =>
              `${i + 1}. ${c.coin} / ${c.stock} — ${usd(c.volume24h)} 24h, ` +
              `${usd(c.liquidityUsd)} liq, ${c.dex}`,
          )
          .join("\n"),
    );
  },
);

server.registerTool(
  "universe_stats",
  {
    title: "Tokenized stock universe",
    description:
      "How many tokenized stocks exist on Solana, how many actually trade, and by which issuer. " +
      "Useful for spotting that most listed tokens have no liquidity.",
    inputSchema: {},
  },
  async () => {
    const d = await index();
    const T = d.totals;
    return text(
      `Tokenized stocks on Solana\n` +
        `  listed:    ${T.universe} (${Object.entries(T.byIssuer).map(([k, v]) => `${k} ${v}`).join(", ")})\n` +
        `  tradeable: ${T.tradeable} above $5k liquidity\n` +
        `  holders:   ${T.universeHolders.toLocaleString()}\n` +
        `  24h vol:   ${usd(T.universeVolume24h)}\n\n` +
        `Used as quote assets: ${T.denominators}\n` +
        `Coins quoted in them: ${T.quotedCoins} (${usd(T.quotedVolume24h)} 24h)\n` +
        `With a 24/7 Pyth reference price: ${T.with247Feed} of ${T.denominators}\n\n` +
        `Snapshot ${d.generatedAt}`,
    );
  },
);

await server.connect(new StdioServerTransport());
