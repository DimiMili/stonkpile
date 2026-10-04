/**
 * What you can actually redeem it for.
 *
 * This is the oldest question a rating agency asks and the one nothing else on
 * this site answers: not how deep the pool is, but what claim you hold when you
 * want out through the front door rather than through a pool. Three tokens on
 * the same company can be a claim on real shares, a claim on cash, or a claim
 * on an SPV that owns shares, and those are not the same instrument.
 *
 * Deliberately NOT part of the score.
 *
 * Everything in the rating traces to a number this site measured. This traces
 * to a document somebody wrote, which is a different kind of claim with a
 * different failure mode: being wrong about a pool costs a point, being wrong
 * about an issuer's legal terms is a false statement about a business. It is
 * also constant per issuer, so scoring it would move every one of an issuer's
 * tokens by the same amount and tell you nothing about any of them.
 *
 * So it is shown, sourced and dated, beside the score rather than inside it.
 *
 * Read on 4 October 2026 from the sources named. Terms change; the date is part
 * of the fact. Where an issuer has not stated something in a source we could
 * read, this says so rather than filling the gap.
 */

import type { Issuer } from "@/lib/pipeline";

export type Claim =
  /** Redeemable for the underlying security itself. */
  | "shares"
  /** Redeemable, but for cash or stablecoins at the value of the underlying. */
  | "cash"
  /** No redemption terms found in a source we could read. */
  | "unstated";

export interface Redemption {
  claim: Claim;
  /** One line, in the issuer's own terms where possible. */
  what: string;
  /** Who can actually do it. */
  who: string;
  /** Where this was read. */
  source: string;
  sourceUrl: string;
  /** When it was read. */
  asOf: string;
  /** Second source where one exists, because one page is one page. */
  alsoUrl?: string;
}

export const REDEMPTION: Record<Issuer, Redemption> = {
  xStocks: {
    claim: "cash",
    what:
      "A tracker certificate giving economic exposure, with no shareholder rights. " +
      "Dividends on the underlying are reinvested into more of the same token rather than paid out.",
    who: "Redeemable directly with the issuer, retail included, subject to KYC and a $5,000 minimum. Not offered in the United States.",
    source: "xStocks documentation and Kraken's risk disclosure",
    sourceUrl: "https://docs.xstocks.fi/docs/frequently-asked-questions",
    alsoUrl: "https://www.kraken.com/legal/xstocks",
    asOf: "2026-10-04",
  },
  Backpack: {
    claim: "shares",
    what:
      "Each token is redeemable 1:1 for the real underlying security, held as a claim on an SPV that owns the assets. " +
      "Dividends are reinvested into additional tokenized shares.",
    who: "Through Backpack Securities. Eligibility terms are not set out on the page we read.",
    source: "Backpack Securities support documentation",
    sourceUrl: "https://support.backpack.exchange/backpack-securities/tokenized-securities",
    asOf: "2026-10-04",
  },
  Ondo: {
    claim: "cash",
    what:
      "Economic exposure, not title. One token is not one share: these are total return trackers, " +
      "so dividends are reinvested and the token drifts from the share price over time. " +
      "Redeemable for cash or stablecoins at the then-value of the underlying, never for shares.",
    who: "Non-US investors, KYC required, institutional only for now with retail onboarding stated as coming.",
    source: "Ondo Global Markets documentation",
    sourceUrl: "https://docs.ondo.finance/ondo-global-markets/overview",
    asOf: "2026-10-04",
  },
  PreStocks: {
    claim: "cash",
    what:
      "Backed by SPVs that hold shares in the private companies. No voting, dividend or information rights. " +
      "Redeemable for USDC at fair market value, with the tokens frozen while the SPV sells the shares off chain.",
    who: "Issued under Regulation S to non-US investors. Redemption requires KYC and a fee; buying and selling on chain does not.",
    source: "Third-party write-ups, not the issuer's own terms page",
    sourceUrl: "https://www.blocmates.com/articles/prestocks-modernizing-and-democratizing-access-to-pre-ipo-stocks",
    asOf: "2026-10-04",
  },
  Tessera: {
    claim: "unstated",
    what:
      "Issued through an SPV structure according to third-party reviews, with no lock-up. " +
      "We could not read a statement from Tessera itself on what a holder can redeem a token for.",
    who: "Not stated in a source we could read.",
    source: "Third-party comparison of pre-IPO platforms",
    sourceUrl: "https://www.odaily.news/en/post/5210562",
    asOf: "2026-10-04",
  },
};

export const CLAIM_LABEL: Record<Claim, string> = {
  shares: "Redeemable for shares",
  cash: "Redeemable for cash",
  unstated: "Redemption not stated",
};
