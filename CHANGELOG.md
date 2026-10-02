# Changelog

What shipped, newest first. One line per change, written the day it went out.

This file exists for two reasons. It is the source the daily build-in-public
post is written from, and it is the only record of this project's pace that
survives outside a git log, which matters when the work is being judged on
what was built inside a hackathon window.

Dates are Athens time.

## 2 October 2026

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
