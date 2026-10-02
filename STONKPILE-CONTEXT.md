# Stonkpile: context for an assistant

Written 2 October 2026 for Colosseum Copilot, or any agent that needs to
understand this project without reading the codebase. Figures are from the live
index at 16:55 Athens on 2 October and move on every rebuild, so treat them as
the shape of the thing rather than as current numbers. The live source is
always https://stonkpile.xyz/api/index.

## What it is in one line

Every tokenized stock on Solana, and whether the one you are about to buy is
the real one.

## The problem

Tokenized equities are the fastest growing thing on Solana and almost nothing
about them is legible to a buyer. Five issuers list the same companies under
colliding tickers. Anyone can mint a token called NVDAx. Most listings have no
market at all, so "available" and "buyable" are completely different facts.
Somebody holding a ticker has no way to tell an issued security from a
memecoin wearing its symbol.

## The mechanic

Issuers are verified by the host serving the token's metadata, not by what the
token calls itself. A token claiming to be an xStock whose metadata is not
served from the issuer's own domain is an impostor, and the check cannot be
faked by naming yourself correctly.

Everything else on the site is built on top of that single verified identity:
whether it has liquidity, how deep, whether a reference price exists, what is
priced against it, and whether a perp market exists on the same company.

## Current numbers (2 Oct 2026)

- 1,799 tokenized stocks listed across five issuers
- 112 with a market, covering 102 distinct companies
- $46.4M of liquidity in total
- 947 coins priced in a tokenized stock rather than in SOL
- 28 companies with a 24/7 reference price feed
- 61 with a perp market on Phoenix or Hyperliquid

Per issuer, listed / with a pool / liquidity:

- xStocks: 1,271 / 33 / $27.9M
- Backpack (Sunrise): 68 / 66 / $13.9M
- Ondo: 448 / 2 / $71k
- PreStocks: 9 / 8 / $3.19M
- Tessera: 3 / 3 / $1.27M

The Ondo line is the sharpest fact on the site. 448 tokenized stocks listed,
two of them have a pool, $71k behind the entire catalogue. Listing costs an
issuer nothing, so catalogue size proves nothing and almost everybody quotes
catalogue size.

## What is built

A Next.js app on Vercel, open source under MIT at github.com/DimiMili/stonkpile,
no token, no wallet required, no account.

- A lookup: paste a ticker or a contract address, get issuer, market, depth,
  reference price state and what is quoted against it
- A ranked board of every stock with a market, by liquidity
- Volume against depth on log axes, which exposes wash trading: pools whose
  24h volume is a large multiple of their own contents
- Issuer breakdown, catalogue size against actual depth
- Coins priced in stocks rather than in SOL
- Cross-issuer price comparison for the same company
- Oracle coverage: which companies have a price after the US closing bell
- A daily snapshot committed to data/history.json, four days deep so far,
  which is the only record of this category's movement that exists anywhere
- A public JSON API at /api/index
- /api/verify/[mint], a machine-readable verdict for agents: a closed set of
  outcomes (issued, quoted_coin, impostor, unknown), a boolean, and tagged
  reason codes rather than a paragraph to parse
- An MCP server at /api/mcp with nine tools

Data sources are all keyless and public: Jupiter, DexScreener, Pyth, Phoenix,
Hyperliquid.

## Findings the data has produced

- Ondo lists 448 and two have a pool
- The most liquid tokenized stock on Solana has repeatedly been Micron, ahead
  of SPY and NVDA, which is not what anyone assumes
- 74 of the companies being used as money have no price after the closing bell
- Across all pools, the median turns over its own contents about once a day;
  a handful turn over 80 to 320 times, and the worst offenders are memecoins
  quoted against a stock, whose bots inflate the stock's volume as a side
  effect
- Cross-issuer price gaps are concentrated entirely in pre-IPO assets, where
  no public market price exists, rather than being issuers disagreeing

## Known weaknesses, stated honestly

- Cross-issuer gap display currently mixes live-market assets with pre-IPO
  assets that have no reference price, which makes a unit mismatch look like
  an accusation. Being split into two sections.
- No onchain action yet. No wallet connect, no swap. Planned: route a buy into
  the deepest verified pool.
- Solana only. The same method would work on Ethereum, BNB, Base and Robinhood
  Chain, since DexScreener already covers them; only token discovery is
  Solana-specific today.
- Solo builder. No cofounder.
- History is four days deep. It compounds daily and cannot be backfilled,
  which is both the weakness now and the moat later.

## Where it is going

The product is the interpretation layer, not the data. Every input is free and
public, so a raw feed is worth nothing; the judgment built on top of it is the
thing. The direction is a trust score per tokenized stock, computed from issuer
verification, liquidity, oracle coverage and price deviation from reference,
that a wallet or terminal can call before routing a swap. A credit check for
tokenized stocks on Solana.

## Context for a hackathon assistant

Entered in the Stocklana hackathon (judged early October) and in Colosseum
Crypto World's Fair with Superteam Balkan, submission due 12 October 2026.
The repo was started 24 September, inside the hackathon window. Built by
Takisoul (@takisoul, GitHub DimiMili), a Solana brand and content operator in
Athens, not a career engineer.

The useful questions to ask of a corpus of past hackathon submissions:

1. Has anyone previously built a verification or registry layer for tokenized
   equities, on any chain, and what happened to it?
2. Has anyone built issuer verification by metadata host, as opposed to by
   allowlist?
3. What have past winners in the RWA and tokenized-asset category had in
   common, and how many of them had an onchain action versus being read-only?
4. Which projects won while being solo-built, and what compensated for it?
5. Has anyone sold verification or scoring as infrastructure to wallets, and
   did it find customers?
