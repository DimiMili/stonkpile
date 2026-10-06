# Stonkpile

**Every tokenized stock on Solana, rated.**

Most of them are listed and nothing more. The ones with a market behind them get a
score out of 100 for that market. The rest get a page saying why they do not have
one.

[![Stonkpile: every tokenized stock on Solana, rated](https://stonkpile.xyz/api/card/board.png)](https://stonkpile.xyz)

That picture renders live from the index, so it is current whenever you are reading
this. There are no counts written into this file on purpose: they move every night,
and a README that states one is wrong by morning. For exact figures, open
[stonkpile.xyz](https://stonkpile.xyz) or `GET /api/index`.

Built for [Stocklana](https://hackathons.solana.com/hackathons/stocklana) and
entered in the Colosseum Crypto World's Fair with Superteam Balkan.

---

## The problem

Listing a tokenized stock costs an issuer almost nothing. Funding a market behind it
costs real money. So the catalogues are enormous and nearly empty, and nothing tells
you which is which.

The scale of it is the part people get wrong. One issuer has funded two pools in a
catalogue of hundreds, and between them they hold less than a used car is worth.
Another lists over a thousand tokens and has funded pools behind a few dozen. A
buyer searching for a ticker finds a token, a price and a chart, and no way to know
whether there is anything on the other side of the trade.

Volume does not answer it either. A pool can show tens of times its own size in a
day, which is the same money going round rather than demand turning up. Filling a
pool costs real money; pushing trades through one costs almost nothing, so anyone
can make a token look busy.

## The rating

Every tokenized stock with a market gets one number out of 100, built from four
parts, each scored out of 10 and carrying its own weight. Ten across all four is
exactly 100, so the total can be checked by hand.

| Part | Weight | What it measures |
|---|---|---|
| **Liquidity** | ×4 | How much you can sell into before you move the price |
| **Real volume** | ×2.5 | Turnover against the pool's own size. A dead pool and a pool doing 80x a day both fail |
| **Pools & perps** | ×2 | More than one venue to sell into, and a perp to hedge or short with |
| **Pricing** | ×1.5 | A price after the US close, and other issuers agreeing on it per underlying share |

Letters, because there is no standard for scoring a token market and the one
convention everybody already reads is the credit scale.

| | | |
|---|---|---|
| **A** Prime | 80+ | deep, traded, priceable, more than one way out |
| **B** Sound | 62+ | a real market missing one or two things |
| **C** Thin | 42+ | fine in small size, not much more |
| **D** Fragile | under 42 | one pool, barely traded, or volume that is not real |

Two gates come before any score. A token whose metadata is not served from a
verified issuer's own host is not rated at all. Neither is one with no market. One
hard cap: nothing is Prime while another issuer prices the same company more than
10% away per underlying share.

**It rates the market around a token, never the company behind it**, and never
whether the price is fair.

Every weight is a constant at the top of [`lib/rating.ts`](lib/rating.ts) and every
point traces to a figure already published on the site. The full recipe, including
why each threshold is where it is, is in [RATING.md](RATING.md). Nobody applies and
nobody pays to be rated.

### What you get back, which is not scored

Three tokens on the same company can be a claim on real shares, a claim on cash, or
a claim on an SPV that owns shares. Those are not the same instrument, and no pool
depth can tell you which one you hold. So [`lib/redemption.ts`](lib/redemption.ts)
carries what each issuer states, with the source it was read from and the date,
shown beside every rating.

It is deliberately outside the score. Everything in the rating traces to a number
this site measured; this traces to a document somebody wrote, which is a different
kind of claim with a different failure mode.

## Issuer verification

A token's name proves nothing. More than a thousand tokens in Jupiter's verified
list carry one issuer's brand in their name or symbol, and a name is the one thing
anybody can copy. What cannot be copied is the host serving the metadata, so the
index reads that instead.
`ISSUERS` in [`lib/pipeline.ts`](lib/pipeline.ts) is the allowlist, and every issuer
on the site is there because the metadata comes from a domain they control.

The same check runs the other way for coins. A coin taking the exact symbol of a
real tokenized stock is flagged as a lookalike, case sensitive, because an
impersonator copies the casing and looking right is the entire point.

Seven issuers are verified this way: xStocks, Ondo, Backpack Securities, PreStocks,
Tessera, Securitize and Superstate. The site compares them on catalogue against
funded pools rather than on catalogue alone, because listing a token costs an issuer
nothing and a big catalogue proves nothing on its own. Two of them have funded
almost everything they list; two have funded almost none of it; the gap between
those two habits is the most useful thing on that section of the site.

Securitize and Superstate record the share with a registered transfer agent rather
than minting against a custodied claim, and neither has a pool on Solana, so both
are unrated. That is the correct verdict rather than a gap.

Current figures per issuer: `GET /api/index`, or the issuer comparison on the
home page.

## What else it reads

- **Corporate actions, from the chain.** Every mint is checked for Token-2022's
  `ScaledUiAmount` extension, so a split or an accrual an issuer encodes on-chain is
  a number the site reads rather than one somebody types in. Cross-issuer prices are
  compared per underlying share because of it: SpaceX went from "399% apart" to 41%
  once one issuer's token was understood as five post-split shares.
- **Balances that grow on their own.** Some tokenized stocks are larger than the
  tokens that were bought, because the issuer passes a dividend through by rebasing
  rather than paying cash. The multiplier is read from the mint, with the date it
  last moved.
- **Perp markets.** Every rated stock shows whether it has a perp on Phoenix or
  Hyperliquid, linking to that exact market.
- **A daily record.** One snapshot a day is committed to `data/history.json` by a
  GitHub Action. That is the entire storage layer: no database, no keys, and the
  history lands in git next to the code that produced it, so anybody can check what
  the site claimed on a given day.

## Architecture

```
lib/pipeline.ts      the index. universe -> pairs -> pyth -> chain. no keys, no database
lib/rating.ts        the rating. every weight a constant at the top
lib/redemption.ts    what each issuer says you can redeem for, sourced and dated
lib/sections.ts      one definition per question, shared by every page that asks it
app/page.tsx         the board, server-rendered, ISR every 5 minutes
app/s/[stock]        a page per tokenized stock, with its rating and the working
app/[section]        /rating, /earning and /volume, each with its own card
app/api/index        the same data as JSON, open CORS
app/api/verify/[mint] a machine-readable verdict for agents
app/api/mcp          remote MCP endpoint, JSON-RPC over HTTP
lib/mcp-tools.ts     the agent tools
mcp/server.mjs       local MCP server over stdio
pipeline.py          the original Python prototype, kept for offline runs
```

No database. No API keys. No cron server. Vercel's ISR does the caching and a GitHub
Action does the daily record.

### Data sources, all keyless and public

| Source | Used for |
|---|---|
| `lite-api.jup.ag/tokens/v2/tag?query=verified` | token universe, holders, price, liquidity |
| `api.dexscreener.com/token-pairs/v1/solana/{mint}` | every pair per stock token |
| `hermes.pyth.network/v2/price_feeds?asset_type=equity` | which tickers have a 24/7 `Equity.Index` feed |
| `benchmarks.pyth.network/v1/price_feeds/{id}` | US market open and closed state |
| Solana RPC `getAccountInfo` / `getTokenSupply` | Token-2022 `ScaledUiAmount`, splits and accrual |

**Pyth note:** Hermes price *updates* now require Pyth Pro auth (HTTP 401). Feed
discovery and market-hours state are still public, which is what this build uses.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Deploy: push to GitHub, import the repo on Vercel. No environment variables are
required. `SOLANA_RPC` overrides the public mainnet endpoint and `SNAPSHOT_TOKEN`
gates `/api/snapshot`, which is read by exactly one caller a day.

## For agents

Stonkpile speaks [MCP](https://modelcontextprotocol.io) two ways, and the remote one
needs no install.

```
https://stonkpile.xyz/api/mcp
```

Add that as a remote MCP server in any MCP client. Streamable HTTP, stateless, no
key, no account. It reads the same index the site renders, so an agent and a human
never see different numbers.

```bash
curl -s -X POST https://stonkpile.xyz/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The transport is plain JSON-RPC in `app/api/mcp/route.ts` with the tools in
`lib/mcp-tools.ts`. No MCP server framework, so there is one fewer dependency to
trust and the whole thing reads in a sitting.

Locally, over stdio:

```bash
STONKPILE_API=https://stonkpile.xyz/api/index npm run mcp
```

```json
{
  "mcpServers": {
    "stonkpile": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.mjs"],
      "env": { "STONKPILE_API": "https://stonkpile.xyz/api/index" }
    }
  }
}
```

### Tools

| Tool | Answers |
|---|---|
| `check_stock` | Is this ticker a genuinely issued tokenized stock, or a lookalike? |
| `universe_stats` | How many exist, how many have a market, by issuer |
| `market_session` | Is the US market open, and when does it next open or close |
| `list_denominators` | Which stocks are being used as quote assets, ranked |
| `coins_quoted_in` | Every coin priced against one stock |
| `top_coins` | The largest stock-denominated coins by 24h volume |

`check_stock` is the one worth having in an agent: it is the anti-lookalike check.

### One verdict, for a wallet or a bot

```
GET /api/verify/<mint>
```

Returns a closed set of outcomes with tagged reasons and the rating with its four
parts, rather than a paragraph to parse. This is the composable surface: any wallet,
explorer or agent can ask "is this token what it claims, and what is the market
around it like" in one request, with no key.

## HTTP API

```
GET /api/index
GET /api/index?stock=NVDAx        one stock, by symbol or underlying ticker
GET /api/index?limit=25&slim=1    trim the payload
GET /api/verify/<mint>            one verdict, with the rating
```

Open CORS on both.

## Share cards

Every page renders a live 1200x630 card, so a link posted today does not go stale on
the timeline.

```
/api/card/board.png              the summary card: the four bands and their counts
/api/card/NVDAx.png              one stock's rating, with its four parts as bars
/api/card/NVDAx.png?view=coins   what is priced in that stock instead
/api/chart/rating.png            a section's chart
/cards                           browse them all
```

Rendered with `next/og` (Satori), fonts vendored in `assets/fonts`, so there is no
runtime font fetch and no headless browser.

## Security

Dependencies are pinned to versions with a clean `npm audit` (Next 16.3.5, React
19.3). Next 15.x ships a bundled postcss and sharp with open high-severity
advisories that only the 16.x line resolves, which is why this is on 16.

Two things were found and fixed by auditing rather than by being hit:
`/api/card/[stock]` rendered a full image for any string, so walking
`/api/card/AAAA.png` upward could mint unlimited expensive renders and unlimited CDN
cache entries. An unknown ticker now costs a string comparison. And `/api/snapshot`
rebuilds the whole index on every request while being read by exactly one caller a
day, so it takes a shared secret.

No keys are committed. `.env*` is gitignored and the daily job reads its token from
a repository secret.

## Where this goes

The data is public and keyless, which means selling it would be selling something
anybody can fetch. The product is the aggregation and the interpretation: one place
that already asked the questions, with a method anybody can check.

**Now.** The rating, free and open, with the recipe published. The thing that makes
it worth trusting is that nobody applies and nobody pays, so it stays that way.

**Next.** Referral links on the issuers and venues the site already points people
to, under three rules that keep the rating honest: every ranking is computed before
any link exists, the referral is disclosed on the page, and it sits only on an
action button, never on a venue's name inside a ranked row.

**After that.** The verification layer. `/api/verify` and the MCP endpoint already
answer "is this token real and what is the market around it like" in one keyless
request. A wallet, an explorer or an agent that wants to warn a user before they buy
a lookalike or a token with no exit does not want to rebuild this, and there is
nothing else to call.

Not now, and listed so it is clear they are not the plan: user profiles, a
leaderboard, a token. There is no token and there will not be one.

## Changelog

[CHANGELOG.md](CHANGELOG.md), newest first, written the day each thing shipped. It
is also the record of what was built inside the hackathon window.

## License

MIT. See [LICENSE](LICENSE). Fork it, run it, ship something better with it.

## Built by

[Takisoul](https://x.com/takisoul). A Solana power user here to build cool shit,
even though I am not a developer.

I decided what this should do and what it should not, found the things that were
wrong with it, and Claude wrote the code.

If you find a bug, or a token the issuer check gets wrong, or a rating you think is
wrong, open an issue or hit me up on X. Issuers included: if your redemption terms
are recorded wrong here, tell me and I will correct them with your source.
