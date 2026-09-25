# Stonkpile

**Wall Street is the denominator now.**

Every memecoin on Solana that is quoted *against* a tokenized stock, indexed live
across all five issuers, plus a remote MCP server so agents can read the same data.

Built for [Stocklana](https://hackathons.solana.com/hackathons/stocklana).

---

## What it found

Several companies are tokenized by more than one issuer. Lining them up side by side
is the whole argument for why reference prices matter:

| Company | | | Gap |
|---|---|---|---|
| MicroStrategy | $158.14 xStocks | $158.33 Backpack | **0.1%** |
| Intel | $118.54 xStocks | $118.32 Backpack | **0.2%** |
| S&P 500 | $763.00 xStocks | $766.43 Ondo | **0.4%** |
| Robinhood | $119.68 xStocks | $120.95 Backpack | **1.1%** |
| OpenAI | $1,038.24 Tessera | $1,343.38 PreStocks | **29%** |
| Kalshi | $447.14 Tessera | $855.80 PreStocks | **91%** |
| SpaceX | $562.13 Tessera | $115.75 PreStocks | **386%** |

Public companies agree to within about one percent. There is a Pyth feed and a real
market to arbitrage against. Private companies have neither, and they come apart.

Part of a wide gap may be denomination rather than disagreement: one issuer's token
can represent a different slice of a share. That is the problem, not a caveat to it.
For a private company there is no reference price published anywhere, so a buyer
cannot tell which of the two they are looking at. For the public names, they can.

## The thing nobody else has

Pump.fun's Custom Pairs (10 Sep 2026) and Meteora's StockLaunch (15 Sep 2026) let
creators launch tokens quoted in tokenized equities instead of SOL or USDC. Eleven
days later that is a real market with no index, no discovery layer and no search
result. You cannot web-search "which memecoins are priced in Lockheed Martin".

At last run:

| | |
|---|---|
| Tokenized stocks listed on Solana | **1,645** (xStocks 1,124, Ondo 448, Backpack 61, PreStocks 9, Tessera 3) |
| Of those, actually tradeable | **102** above $5k liquidity |
| Stocks used as a quote asset | **98** |
| Coins quoted in them | **1,184** |
| Their combined 24h volume | **~$37.3M** |
| Holders of tokenized stock | **~1,002,000** |
| With an always-on Pyth reference price | **23 of 96** |

That last row is the product. GameStop and the S&P 500 are the two biggest
denominators on Solana and **neither has a 24/7 oracle**. Coins quoted against them
trade all night against nothing.

## Architecture

```
lib/pipeline.ts      the index. universe -> pairs -> pyth. no keys, no database.
app/page.tsx         the board, server-rendered, ISR every 5 minutes
app/api/index/route  the same data as JSON, open CORS
app/api/mcp/        remote MCP endpoint, JSON-RPC over HTTP
lib/mcp-tools.ts     the six agent tools
mcp/server.mjs       local MCP server over stdio, reads /api/index
pipeline.py          the original Python prototype, kept for offline runs
```

No database. No API keys. No cron. Vercel's ISR does the caching.

### Data sources (all keyless, all public)

| Source | Used for |
|---|---|
| `lite-api.jup.ag/tokens/v2/tag?query=verified` | token universe, holders, on-chain price, liquidity |
| `api.dexscreener.com/token-pairs/v1/solana/{mint}` | every pair per stock token |
| `hermes.pyth.network/v2/price_feeds?asset_type=equity` | which tickers have a 24/7 `Equity.Index` feed |
| `benchmarks.pyth.network/v1/price_feeds/{id}` | US market open/closed state |

**Issuer verification:** ~930 tokens have "xStock" in their name; only the ones whose
metadata is served from the issuer's own host are real. `ISSUERS` in `lib/pipeline.ts`
is that allowlist. This is what keeps lookalike tokens out of the index.

**Pyth note:** Hermes price *updates* now require Pyth Pro auth (HTTP 401). Feed
discovery and market-hours state are still public, which is what this build uses.
The Pyth bounty grants 3 months of Pyth Pro, which unlocks live reference prices and
turns the oracle-gap section from a diagnosis into a product.

## Security

Dependencies are pinned to versions with a clean `npm audit` (Next 16.3.5, React 19.3).
Next 15.x ships a bundled postcss and sharp with open high-severity advisories that
only the 16.x line resolves, which is why this is on 16.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Deploy: push to GitHub, import the repo on Vercel, no environment variables needed.

## MCP server

Stonkpile speaks [MCP](https://modelcontextprotocol.io) two ways. The remote one
needs no install.

### Remote (recommended)

```
https://<your-deploy>/api/mcp
```

Add that URL as a remote MCP server in any MCP client. Streamable HTTP
transport, stateless, no key, no account. It reads the same index the site
renders, so an agent and a human never see different numbers.

Raw, if you want to see it work:

```bash
curl -s -X POST https://<your-deploy>/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The transport is plain JSON-RPC in `app/api/mcp/route.ts`, with the tools in
`lib/mcp-tools.ts`. No MCP server framework, so there is one fewer dependency
to trust and the whole thing is readable in a sitting.

### Local, over stdio

```bash
STONKPILE_API=https://<your-deploy>/api/index npm run mcp
```

`claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "stonkpile": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.mjs"],
      "env": { "STONKPILE_API": "https://<your-deploy>/api/index" }
    }
  }
}
```

### Tools

| Tool | Answers |
|---|---|
| `check_stock` | Is this ticker a genuinely issued tokenized stock or a lookalike? |
| `universe_stats` | How many exist, how many actually trade, by issuer |
| `market_session` | Is the US market open, and when does it next open or close |
| `list_denominators` | Which stocks are being used as quote assets, ranked |
| `coins_quoted_in` | Every coin priced against one stock |
| `top_coins` | The largest stock-denominated coins by 24h volume |

`check_stock` is the one worth having in an agent: it is the anti-lookalike
check, and it is only available over the remote endpoint.

```
> list_denominators(limit: 5, only_without_247_feed: true)

1. GMEx (GME, xStocks) — 12 coins, $8.22M 24h vol, top: +++++  [no 24/7 feed]
2. SPYx (SPY, xStocks) — 11 coins, $6.99M 24h vol, top: STONK  [no 24/7 feed]
3. GLDx (GLD, xStocks) — 11 coins, $2.42M 24h vol, top: GP     [no 24/7 feed]
4. CYPH (Backpack)     — 18 coins, $1.28M 24h vol, top: CYPHERCAT
5. LMT  (Backpack)     — 24 coins, $1.20M 24h vol, top: wardog
```

## Share cards

Every denominator renders a live 1200x630 card. The numbers are current at the
moment the link is opened, so a card posted today does not go stale on the timeline.

```
/api/card/board.png      the summary card
/api/card/LMT.png        by token symbol
/api/card/GME.png        or by underlying ticker
/cards                   browse and grab them all
```

Rendered with `next/og` (Satori) and fonts vendored in `assets/fonts`, so there is
no runtime font fetch and no headless browser.

## Share pages

`/s/<stock>` is the link you post. It carries Open Graph and Twitter card tags
pointing at that stock's live card, so X, Slack and Discord unfurl it as an image
with a real headline ("25 coins are priced in Lockheed Martin").

```
/s/LMT    /s/GMEx    /s/GME
```

`lib/site.ts` resolves the absolute base URL from Vercel's own environment, so
nothing is hardcoded. Override with `NEXT_PUBLIC_SITE_URL` for a custom domain.

## HTTP API

```
GET /api/index
GET /api/index?stock=LMT          one denominator, by symbol or underlying
GET /api/index?limit=25&slim=1    trim the payload
```

## License

MIT. Fork it, run it, ship something better with it.

## Built by

[Takisoul](https://x.com/takisoul). Just a Solana power user here to build cool shit,
even though I am not a developer.

I decided what this should do and what it should not, found the things that were wrong
with it, and Claude wrote the code. It took a few days.

If you find a bug or a token the issuer check gets wrong, open an issue or hit me up on X.

There is no token and there will not be one.
