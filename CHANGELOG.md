# Changelog

What shipped, newest first. One line per change, written the day it went out.

This file exists for two reasons. It is the source the daily build-in-public
post is written from, and it is the only record of this project's pace that
survives outside a git log, which matters when the work is being judged on
what was built inside a hackathon window.

Dates are Athens time.

## 5 October 2026

- The rating is the share card. Every link to a ticker page now unfurls as the
  letter, the score out of 100 and the four parts as bars, in the band's own
  colour, with the liquidity, the day's volume and what the issuer redeems for
  along the bottom. The old card led with how many memecoins were priced in the
  stock, which was the subject when this was Ticker Wars and is a section of the
  page now; it is still there at ?view=coins. The headline, the page title and
  the share text say the rating too, so a posted link sells what the site is
  rather than what it used to be.
- The card's liquidity figure was the memecoin pools quoted against the stock
  while the bar above it scored the stock's own pool. NVIDIA read $898k under a
  liquidity score computed from $5.06M. Both are the stock's own pool now.
- Nine rated stocks had no page. Intel rates B Sound on real liquidity and its
  page said "Nothing is priced in INTC" with a list of other tickers, because
  the page opened on the memecoin count rather than on whether the stock exists.
  Also Robinhood, Tessera's SpaceX, Broadcom, AMD, silver, TSMC, the Ondo S&P
  and UnitedHealth. They are in the sitemap now as well.
- A listing nobody has funded says so instead of being denied. The page used to
  answer "nothing on Solana is called NFLXx", which is false: it is issued and
  verified, and what is missing is a market behind it.
- The share block moved up, directly under the rating. It was at the foot of the
  page, past a ten-row table and a second block of checks, which is about four
  screens down a phone from the point where somebody has already decided.

- The hero stopped lying. It carried typed figures from the day it was written,
  "1,800 listings, 112 with liquidity", while the stats row ten centimetres
  below read the live index. Both numbers now come from the same place, and the
  page agrees with itself.
- The daily charts say out loud that they are last night's record, so the gap
  between them and the live figures reads as yesterday against now rather than
  as a contradiction.
- "Exits" is "Pools & perps" everywhere, matching the launch video.
- The share card says 114 have a market rather than 114 actually trade.

- The daily charts can be read. Hover or drag across one and the headline figure
  becomes that day's, with its date under the chart and a marker on the point.
  One pointer handler covers mouse and touch, and touch-action is pan-y so a
  finger moving down the page still scrolls it. The per-point titles stay for
  screen readers and for a view with no JavaScript.
- "How this is moving" is now "Tokenized stocks on Solana, over time", and the
  shortcut reads "Over time".
- Each part of the rating is scored out of 10 and carries a weight: Liquidity
  x4, Real volume x2.5, Exits x2, Pricing x1.5. Ten across all four is exactly
  100, so the total still adds up by hand, and the four parts can finally be
  compared with each other without arithmetic.

- Rating language, rewritten. The four parts are Liquidity, Real volume, Exits
  and Pricing, which is what they measure in the words the market already uses,
  and the explainer is four lines with their weights instead of a paragraph with
  bold words buried in it. The scale is letters now, A to D, because there is no
  standard for scoring a token market and the one convention everybody reads is
  the credit scale. "Band" is gone; it was our word and nobody else's.
- The nightly snapshot stores names, not just counts. Which tokens have a pool,
  a 24/7 price, a perp, a grade, and which are listed at all, as sorted sets,
  plus stranded liquidity per issuer. Counts could only ever produce "113 have a
  pool, up two"; names produce "Coca-Cola has a market on Solana for the first
  time". New listings and grade changes are computed as a diff when the history
  is read rather than stored, because a stored diff is a second copy of the
  truth that eventually disagrees with the first.

## 4 October 2026

- Corrected the accrual copy. We said nobody had stated what the issuers were
  passing through. xStocks have: dividends on the underlying are reinvested into
  more of the same token, and splits run through the same rebasing mechanism,
  stated in their own documentation and again in Kraken's risk disclosure. 17 of
  the 19 pay a dividend and the order follows the yield; the two that do not,
  DFDV and GameStop, last moved in late 2025 and have not moved since.
- What you can redeem it for, per issuer, beside every rating and as a column on
  the rated board: shares, cash, or not stated, each with the source it was read
  from and the date. Backpack redeems 1:1 for the real security; xStocks and
  Ondo redeem for cash, Ondo never for shares; PreStocks redeems for USDC
  against an SPV; Tessera has stated nothing we could read. Deliberately not
  part of the score, because every point in the score traces to a number this
  site measured and this traces to somebody's terms page.
- A slide answering the obvious question about the Solana Foundation's
  tokens.xyz, which does canonical asset pages, variant tiers and a generic risk
  grade. Their catalogue covers what exists; this rates how good it is, across
  the listings a curated catalogue never shows.

## 3 October 2026

- Three sections got their own URL: /rating, /earning and /volume, each with its
  own title, description and share card. An anchor link could never carry one,
  because the part after the hash never reaches the server, so every #section
  link posted anywhere showed the home page's card. The derivations behind them
  now live in lib/sections.ts, imported by both the home page and the section
  page, so the numbers cannot drift apart.
- The rating. Every tokenized stock with a market now carries one number out of
  100 for the market around it: how much you can get out of (40), whether it is
  being used (25), how many ways out exist (20), and whether it can be priced
  (15). 16 rate Prime, 27 Sound, 51 Thin, 19 Fragile, and the other 1,689
  listings are unrated because nothing was ever funded behind them. Two gates
  come before any score: a token that fails the issuer check is not rated at
  all, and neither is one with no market. One hard cap: nothing is Prime while
  another issuer prices the same company more than 10% away per underlying
  share. The recipe is RATING.md, the code is lib/rating.ts, every weight is a
  constant at the top of it, and every point traces to a figure already on the
  site. /api/verify now returns the rating with its four parts, and each
  token's own page shows its working.
- The open control moved under the preview. You see the strip of chart or the
  first rows, the fade, and then the way in, which is the order every feed
  settled on and the order it was asked for. Done with column-reverse on the
  <details> itself, since the flex items there are the summary and
  ::details-content. An open section says Hide, and closing from the foot of a
  long table puts that section's headline back on screen instead of dropping
  you wherever the page collapsed to.
- Security pass. /api/card/[stock] rendered a full image for any string, so
  anyone walking /api/card/AAAA.png upward could mint unlimited expensive
  renders and unlimited CDN cache entries; unknown tickers now cost a string
  comparison. /api/snapshot rebuilds the whole index on every request and is
  read by exactly one caller a day, so it now takes a shared secret.
- "What you earned by doing nothing", renamed from "Quiet growth". The column
  is Earning rather than Growth, and the per-$1,000 figure moved into the
  sentence instead of being a column.

- Collapsed sections now peek instead of hiding. Each closed section shows the
  top of its chart or its first rows and fades out, so you can see there is
  something worth opening rather than reading a column of headlines. Applied to
  ::details-content, because a closed <details> is not rendered at all and
  clipping the element inside it did nothing.

- New hero. Three questions instead of one: is it real, is anyone actually
  buying it, does it have perps. The standfirst now says what the site holds
  (1,800 listings, 112 with liquidity, five issuers, and the memecoins paired
  with them) rather than describing the search box twice.
- Eyebrow changed from "Tokenized equities as quote assets", which was the
  positioning from when this was only about coins priced in stocks.

## 2 October 2026

- Sections collapse. Nine of them now open on a tap, keeping their headline,
  their "right now" finding and the explainer visible, with the table behind a
  pill that says what is inside and how much. The page went from 13,172px to
  5,597px on desktop and 6,720px on a phone, with every number one tap away.
  Built on <details>, so it works before React hydrates, the keyboard and
  screen-reader behaviour is the browser's own, and find-in-page opens a closed
  section to reach a match.
- Starter chips under the search box: NVDA, SPCX, OPENAI. An empty box asks
  you to already know what you are looking for, which is what "I have no idea
  how to use it" meant.
- Sunrise's own mark, from sunrise.xyz. The card said Sunrise and showed the
  Backpack logo, which was simply the wrong logo.
- "The tokens that quietly grew": a section for balances that carry a
  ScaledUiAmount accrual. 19 tokenized stocks are larger than the tokens
  bought, from Strategy PP Variable at 9.18% down to NVIDIA at 0.17%, with the
  per-$1,000 value and the date it last moved. Read from the mint.
- Corporate actions read from the chain. Every mint is checked for Token-2022's
  ScaledUiAmount extension, so a split an issuer encodes on-chain is a number
  the site reads rather than one somebody types in. Cross-issuer prices are now
  compared per underlying share: SpaceX went from "399% apart" to 41%, because
  Tessera's token is five post-split shares and the old number was a unit
  mismatch wearing the costume of an accusation.
- Phone legibility pass. Audited every element rendering under 13px on a
  440px viewport and raised them: body 15 to 16.5, table cells 14 to 15,
  headers 10.5 to 12, "what to look for" 13 to 15, and about twenty labels and
  badges that were sitting at 9.5 to 11px. Desktop is unchanged.
- Section shortcuts moved above the search box, so somebody landing on the page
  meets them before scrolling past the two things they help you skip.
- Long company names now wrap beside their logo instead of underneath it.
- Share buttons wear the platform's own glyph: the tray and arrow on Apple
  devices, three connected nodes on Android and the web. Detected after mount,
  so the server and the browser never disagree about which to draw.
- Shareable charts. Each chart now renders as a branded 1200x630 card at
  /api/chart/<name>.png, with a Share button that hands the phone the image
  itself rather than a link, falls back to a link share, and falls back again
  to copying. A PNG link beside it for desktop.
- Active versus seeded coins. A pool existing and a pool being used are
  different claims, and launchpads now mint these by the hundred daily. 959
  coins are priced in a tokenized stock; 268 of them traded in the last 24
  hours. Anything under 25 trades a day is now marked seeded, and the table
  carries a trade count.
- Tessera's mark taken from their own site, and their issuer card corrected to
  tessera.pe (tesseralab.co is only the metadata host).
- Volume against depth: a new section with a log-log chart of every pool's
  liquidity against its 24h volume, plus a Turnover column on the ranked table.
  Makes wash trading visible instead of letting it top the rankings.
- Chart and Table switch on the new section, so the data is readable without
  the picture.
- Footer disclaimer: not advice, data can be stale or wrong, tokenized stocks
  are mostly a claim on an issuer rather than shares.
- Section shortcuts now read as buttons: larger type, real surfaces, borders.

## 1 October 2026

- Perp markets: every stock on the board now shows whether it has a perp on
  Phoenix or Hyperliquid, with the mark linking to that exact market.
- Issuer and company logos across the ranked table, Coins and Two prices.
- Sticky section shortcuts with scroll-spy, and a back-to-top control.
- SpaceX corrected: it lists on Nasdaq as SPCX, so it is no longer treated as
  a pre-IPO asset and now carries its 24/7 reference feed.
- /api/verify/[mint]: a machine-readable verdict for agents, with a closed set
  of outcomes and tagged reasons rather than a paragraph to parse.

## 30 September 2026

- Daily snapshot pipeline repaired. The endpoint was serving cached payloads
  to the recorder, so three nights of history were lost before this landed.
