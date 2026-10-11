import type { Metadata } from "next";
import { Wordmark } from "@/components/SiteMark";

/**
 * The terms, on their own page.
 *
 * They used to be nine lines of grey text wedged under the footer links, which
 * is the one place on a site where nobody has ever read anything. Everything
 * worth saying was in there and none of it was landing.
 *
 * So it is split two ways. The points that apply to one particular number now
 * sit next to that number, where someone who is about to act on it will see
 * them: what a rating is not, next to the rating; what a tokenized stock is
 * not, next to the issuers. And the whole thing lives here, linked from every
 * one of those notes and from the footer, for the reader who wants it in one
 * piece.
 *
 * Plain language on purpose. A wall of capitals saying NOT FINANCIAL ADVICE
 * tells a reader nothing except that someone was worried; saying which numbers
 * can be wrong, and how, is the part that actually protects them.
 */
export const metadata: Metadata = {
  title: "Terms and disclaimer",
  description:
    "What Stonkpile is, what its numbers are and are not, and who is responsible for what you do with them.",
};

const BLOCKS: { h: string; p: string }[] = [
  {
    h: "This is not advice",
    p: "Nothing on Stonkpile is financial, investment, legal or tax advice, and nothing here is an offer or a recommendation to buy or sell anything. No part of this site is personalised to you, your circumstances or your risk appetite, because the site has no idea who you are. If you want advice, get it from somebody licensed to give it.",
  },
  {
    h: "The numbers are a reading, not a guarantee",
    p: "Stonkpile reports what public onchain sources say at the moment they are read. Prices, liquidity, holder counts and issuer data move constantly. They can be stale by the time you see them, wrong at the source, or deliberately manipulated by someone with an interest in how a token looks. Every figure here carries the time it was taken. Treat it as of that moment and nothing else.",
  },
  {
    h: "A rating is not a safety certificate",
    p: "The rating measures whether a market exists and how it behaves: whether there is liquidity, whether volume is proportionate to it, whether a price feed is live. It says nothing about the company behind the ticker, nothing about whether the price is fair, and nothing about what happens next. A token passing every check on this site can still lose all of its value.",
  },
  {
    h: "Tokenized stocks are generally not shares",
    p: "Most of what this site indexes is a claim on an issuer rather than ownership of a company. What you are entitled to, whether you can redeem, what happens in a corporate action and what you are left with if the issuer fails all depend entirely on that issuer and on the jurisdiction it operates from. Those terms are the issuer's to publish and yours to read. They are not equivalent to holding the underlying stock.",
  },
  {
    h: "Verify before you send a transaction",
    p: "Check the contract address against the issuer's own published list, not against a search result and not against this page alone. Addresses can be spoofed, token names are not unique, and a transaction on Solana cannot be reversed. Do your own research. You are responsible for what you do with anything you read here.",
  },
  {
    h: "The data and the code",
    p: "Stonkpile is open source under the MIT licence and the index is published as a free JSON file with no key and no account. It is provided as is, with no warranty of any kind, and no uptime, accuracy or continuity is promised. If you build something that depends on it, build it to survive the file being wrong or absent.",
  },
  {
    h: "There is no token",
    p: "Stonkpile has not issued a token, is not planning one, and will never ask you to connect a wallet or sign anything. Any account, token, airdrop or presale claiming otherwise is not us.",
  },
];

export default function DisclaimerPage() {
  return (
    <div className="wrap">
      <header>
        <Wordmark />
        <p className="eyebrow">
          <span>Terms</span>
          <span className="dot">/</span>
          <span>Short, and in plain words</span>
        </p>
        <h1>What this is, and what it <em>is not</em>.</h1>
        <p className="standfirst">
          Stonkpile is a record of what public onchain sources say about tokenized stocks on
          Solana. It is not a broker, not an adviser and not a guarantee. Here is the whole
          of it, in seven short pieces.
        </p>
      </header>

      <section className="terms">
        {BLOCKS.map((b) => (
          <div key={b.h} className="term">
            <h2>{b.h}</h2>
            <p>{b.p}</p>
          </div>
        ))}
      </section>

      <footer>
        <span>
          <a href="/">The index</a> &middot; <a href="/docs">Docs</a> &middot;{" "}
          <a href="/api/index">JSON</a> &middot;{" "}
          <a href="https://github.com/DimiMili/stonkpile" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </span>
        <span>
          Questions about any of this go to{" "}
          <a href="https://x.com/takisoul" target="_blank" rel="noopener noreferrer">
            @takisoul
          </a>
          .
        </span>
      </footer>
    </div>
  );
}
