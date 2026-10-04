# The rating

One number out of 100 for the market around a tokenized stock, with every point
traceable to a figure this site already publishes. The code is `lib/rating.ts`
and it is about 200 lines, most of them comments. Read that if this and the code
ever disagree: the code is the rating, this file is the explanation.

## What it answers

If you buy this token today, how well can you price it, hold it and get back
out of it.

## What it does not answer

Whether the company is any good. Whether the price is fair. Whether the issuer
is solvent. Whether you should buy it. A rating here is a statement about a
market, not about a business, and not advice.

## Two gates before any score

A token that fails the issuer check is **not rated**. Scoring an impostor 12 out
of 100 would put it on the same ladder as an issued token, and it is not on that
ladder at all. The verdict layer already answers that question with
`impostor`.

A verified token with **no market** is not rated either. There is no depth, no
turnover and no venue to measure. It is listed, and that is the whole fact.
Today that is 1,689 of the 1,802 listings, which is itself the most useful thing
the rating reports.

## The four pillars

| Pillar | Max | What it measures |
| --- | --- | --- |
| How much you can get out of | 40 | Pool liquidity, log scaled from $5k to $10M |
| Whether it is being used | 25 | 24h volume against the pool's own size |
| Ways out | 20 | Number of venues, plus whether a perp exists to hedge with |
| Whether you can price it | 15 | A 24/7 reference feed, plus agreement with another issuer |

**Depth** is log scaled because the difference between $20k and $200k matters
far more to somebody trying to leave than the difference between $5M and $10M.

**Use** is scored as a band rather than as "more is better". A pool doing
nothing and a pool doing eighty times its own size in a day are both failures,
and any scale that rewards volume rewards the wash trader. Full marks run from
0.05x to 5x a day, which is where ordinary two-way trading sits in this index
(the median pool turns over about half its contents a day). Points fall away
from 5x, and reach zero at 25x.

**Ways out** counts venues before anything else: one pool is a single point of
failure whatever its size. A perp market is worth 6 points on its own, because a
stock you can hedge is a different instrument to one you can only hold.

**Price** has two independent halves. A 24/7 reference feed means the token can
be priced when the US market is shut, which is most of the week. Corroboration
compares the price against any other issuer listing the same company, **per
underlying share**, so an issuer whose token represents five shares is not
treated as disagreeing with one whose token represents one. Where no second
issuer exists there is nothing to corroborate, so that half scores at its
midpoint and says so, rather than quietly punishing a token for being the only
one of its kind.

## The one hard cap

A market cannot be **Prime** while another issuer prices the same company more
than 10% away per share. Capped, not zeroed: the disagreement does not make the
pool shallower or the exits fewer, but it is the one failure a weighted average
would hide, since it is worth 7 points out of 100 and it is the whole question.

## The bands

| Band | Score | Meaning |
| --- | --- | --- |
| Prime | 80+ | Deep, used, priceable, and with more than one way out |
| Sound | 62 to 79 | A real market with one or two things missing |
| Thin | 42 to 61 | Works at small size and not much more |
| Fragile | under 42 | One pool, little use, or trading that does not look like trading |

## Known holes

- **No live reference price.** Deviation from an independent price belongs in a
  rating and is the first thing to add. Pyth's Hermes price updates now require
  Pyth Pro auth, and everything here is keyless by design, so what exists today
  is issuer-against-issuer corroboration instead.
- **No history in the score.** A token that was Prime all month and a token that
  was funded this morning rate the same. The nightly snapshot now records the
  band distribution, so rating movement becomes measurable as that record grows.
- **Holder counts are ignored** on purpose. A large holder base on a token with
  one thin pool describes an airdrop, not a market.
- **Coins quoted against these stocks are not rated.** That is a different
  question with a different method, and putting a memecoin on this scale would
  make the scale meaningless.

## Recompute it yourself

Every input is public and keyless: Jupiter for the universe, DexScreener for
pools, Pyth for feed coverage, Hyperliquid and Phoenix for perps, the Solana RPC
for corporate actions. The weights are constants at the top of `lib/rating.ts`.
Nothing here is a black box, which is the difference between this and the thing
it is named after.
