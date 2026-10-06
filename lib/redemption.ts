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
      "In their own words, these “provide only economic exposure to private companies; confer no ownership, " +
      "voting, dividend, information, or other legal rights”, and may result in total loss with no guaranteed " +
      "secondary-market liquidity. The backing is a basket of SPVs holding shares in the companies. " +
      "Redemption is reported as USDC at fair market value, with the tokens frozen while the SPV sells the " +
      "shares off chain, which means the price is set by an actual sale of private stock rather than by a quote.",
    who:
      "Reported as Regulation S, non-US, with KYC and a fee for redemption but not for buying and selling on chain. " +
      "The redemption terms come from third-party write-ups: their own FAQ is a client-rendered accordion we could not read.",
    source: "PreStocks' own disclaimer for the rights, third-party write-ups for the redemption mechanics",
    sourceUrl: "https://prestocks.com/faq?tab=mechanics",
    alsoUrl: "https://www.blocmates.com/articles/prestocks-modernizing-and-democratizing-access-to-pre-ipo-stocks",
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
  /* Securitize and Superstate are a different shape to the five above, and the
     honest entry for both is that we have not read their own terms.

     What is established: SECZ is Securitize's own stock, tokenized on the day
     it listed on the NYSE, with Securitize itself the registered transfer
     agent, issued natively as an SPL token rather than wrapped. Superstate's
     Opening Bell puts SEC-registered equities on Solana the same way, and
     Galaxy Digital is the one carrying a Solana token here.

     If the token is the registered share, "redeem" is close to the wrong word:
     there is no custodied asset behind it to claim, because the holder is on
     the register. That is a stronger position than anything else on this list
     and we are not going to assert it from press coverage. Both pages that
     would settle it need JavaScript to render and did not come back readable,
     so these say "not stated" until somebody reads the terms themselves. */
  Securitize: {
    claim: "unstated",
    what:
      "SECZ is Securitize's own stock, tokenized on its NYSE listing day and issued natively on Solana " +
      "rather than wrapped, with Securitize as the registered transfer agent. " +
      "We could not read Securitize's own statement of what a holder can redeem or convert a token for.",
    who: "Not stated in a source we could read.",
    source: "Securitize's press announcement and third-party coverage of the SECZ listing",
    sourceUrl: "https://securitize.io/learn/press/securitize-tokenizes-secz-stock-onchain",
    alsoUrl: "https://app.rwa.xyz/assets/SECZ",
    asOf: "2026-10-05",
  },
  Superstate: {
    claim: "unstated",
    what:
      "Opening Bell issues SEC-registered equities directly on Solana, with Superstate as transfer agent, " +
      "and the shares are live as collateral in Solana lending markets. " +
      "We could not read Superstate's own statement of what a holder can redeem or convert a token for.",
    who: "Not stated in a source we could read.",
    source: "Superstate's newsroom and The Block's coverage of the Opening Bell launch",
    sourceUrl: "https://superstate.com/newsroom/superstate-equities-now-live-as-defi-collateral",
    alsoUrl: "https://www.theblock.co/post/353344/superstate-unveils-opening-bell-to-bring-sec-registered-equities-onchain-starting-with-solana",
    asOf: "2026-10-05",
  },
};

export const CLAIM_LABEL: Record<Claim, string> = {
  shares: "Redeemable for shares",
  cash: "Redeemable for cash",
  unstated: "Redemption not stated",
};
