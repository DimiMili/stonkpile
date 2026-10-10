import type { Metadata } from "next";
import { Wordmark } from "@/components/SiteMark";
import { TOOLS } from "@/lib/mcp-tools";
import { history, since } from "@/lib/history";

/**
 * The docs page.
 *
 * It exists because of one review on 10 October 2026: "I'm not seeing any docs.
 * How can I access this?" The API has been keyless and open since the first
 * deploy and the MCP server since the second, and neither was reachable from
 * anywhere on the site. A capability nobody can find is a capability we do not
 * have.
 *
 * Written for the person who has already decided they want the data and is
 * looking for the line to copy. No pitch above the first curl. Everything on
 * this page is generated from the same TOOLS array the MCP route serves, so the
 * tool list cannot drift out of date while the server changes underneath it.
 */
export const metadata: Metadata = {
  title: "Docs",
  description:
    "The Stonkpile API and MCP server. Every tokenized stock on Solana, a rating for the ones with a market. No key, no account, open CORS.",
};

/* Hardcoded rather than taken from siteUrl, which resolves to whichever
   deployment is serving the page and would hand a stranger a preview URL to
   curl. Docs get copied by people who are not on this deploy, so the canonical
   host is the only correct one to print. */
const HOST = "https://stonkpile.xyz";

const TSLA = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";

/* The record's own length, read from the file rather than typed, because the
   sentence under it kept going stale. "Every night since 26 September" was in
   the deck and the demo script while the file held 12 records across 15 nights:
   three were missed before the job was automated. Counting beats claiming. */
const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const ENDPOINTS: { path: string; what: string; note: string }[] = [
  {
    path: "/api/verify/{mint}",
    what: "A decision about one contract address",
    note: "The call to make before money moves. Closed-set verdict, a boolean, and the rating if there is one.",
  },
  {
    path: "/api/index",
    what: "The whole index",
    note: "Every listing, every issuer, the totals and the rated set. Takes ?stock=, ?limit= and ?slim=1.",
  },
  {
    path: "/api/lookup",
    what: "The search table",
    note: "Every ticker, name and mint in one small payload, for building your own lookup.",
  },
  {
    path: "/api/mcp",
    what: "The MCP server",
    note: "JSON-RPC over POST. Add it as a remote server in any MCP client.",
  },
  {
    path: "/api/card/{stock}.png",
    what: "A share card",
    note: "Rendered live for any rated ticker, or board.png for the index.",
  },
];

const VERDICTS: { v: string; means: string }[] = [
  { v: "issued", means: "An issuer's own token, verified by the host serving its metadata" },
  { v: "quoted_coin", means: "A real token, but not a stock: something priced against one" },
  { v: "impostor", means: "Wears a stock's ticker and no issuer published it" },
  { v: "unknown", means: "Not in the index. An answer, not an error" },
];

const SAMPLE = `{
  "mint": "${TSLA}",
  "verdict": "issued",
  "clear": true,
  "symbol": "TSLAx",
  "name": "Tesla",
  "issuer": "xStocks",
  "underlying": "TSLA",
  "hasMarket": true,
  "liquidity": 1701317,
  "feed": "247",
  "perpVenues": ["Phoenix", "Hyperliquid"],
  "rating": { "score": 87, "band": "prime", "pillars": [ ... ] }
}`;

export default function Docs() {
  return (
    <div className="wrap">
      <header className="doc-head">
        <p className="eyebrow">
          <a href="/" className="brand"><Wordmark size={19} /></a>
          <span className="dot">/</span>
          <span>Docs</span>
        </p>
        <h1>Build on <em>the index</em></h1>
        <p className="standfirst">
          Every tokenized stock on Solana, a rating for the ones with a market, and a free API.
          No key, no account, no wallet. Open CORS, so it works from a browser.
        </p>
      </header>

      <section>
        <h2>Start here</h2>
        <p className="sec-note">
          Someone hands your product a contract address. One call tells you whether it is
          the issuer&rsquo;s own token, and whether anybody is on the other side of it.
        </p>
        <pre className="code"><code>{`curl ${HOST}/api/verify/${TSLA}`}</code></pre>
        <pre className="code code-out"><code>{SAMPLE}</code></pre>
        <p className="sec-note" style={{ marginTop: 18 }}>
          <code>verdict</code> is one of four values and never anything else, so you can branch
          on it without reading English. <code>clear</code> is the same judgement as a boolean.
        </p>
        <div className="scroll">
          <table className="doc-t">
            <thead>
              <tr><th>verdict</th><th>What it means</th></tr>
            </thead>
            <tbody>
              {VERDICTS.map((x) => (
                <tr key={x.v}>
                  <td><code>{x.v}</code></td>
                  <td className="dex">{x.means}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="callout">
          <b>Every well-formed request returns 200</b>, including <code>unknown</code> and{" "}
          <code>impostor</code>. Those are answers, not failures. A client that treats a 404 as a
          transport error would retry its way into exactly the purchase this is meant to prevent.
        </p>
      </section>

      <section>
        <h2>Endpoints</h2>
        <p className="sec-note">
          All of them GET, all of them keyless, all of them cached for five minutes at the edge.
        </p>
        <div className="scroll">
          <table className="doc-t">
            <thead>
              <tr><th>Path</th><th>Returns</th><th /></tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td><code>{e.path}</code></td>
                  <td>{e.what}</td>
                  <td className="dex">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>MCP, for agents</h2>
        <p className="sec-note">
          The same data as a tool an agent can call, so an AI answering &ldquo;is this token
          real&rdquo; has somewhere honest to look. Add it as a remote server in any MCP client.
        </p>
        <pre className="code"><code>{`${HOST}/api/mcp`}</code></pre>
        <p className="sec-note" style={{ marginTop: 18 }}>
          {TOOLS.length} tools, served from the same index this site renders.
        </p>
        <div className="scroll">
          <table className="doc-t">
            <thead>
              <tr><th>Tool</th><th>What it answers</th></tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td><code>{t.name}</code></td>
                  <td className="dex">{t.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>The rules</h2>
        <div className="doc-rules">
          <p className="lookfor">
            <span className="k">Freshness</span>
            The index rebuilds every five minutes. Everything carries{" "}
            <code>generatedAt</code>, and you should show it rather than implying the number is live
            to the second.
          </p>
          <p className="lookfor">
            <span className="k">Rate limits</span>
            None today. There is no key to issue and no account to suspend. If that changes it will
            be because somebody made it necessary, and it will be announced here first.
          </p>
          <p className="lookfor">
            <span className="k">The record</span>
            {history.length} nightly snapshots so far, the first on{" "}
            {since ? fmtDay(since) : "the day this started"}, each one committed to the repo after
            the US close. Three nights are missing at the end of September, before the job was
            automated. It is public and auditable because it sits in git next to the code that
            produced it, and it is the one thing here that cannot be backfilled.
          </p>
          <p className="lookfor">
            <span className="k">Attribution</span>
            MIT. Use any of it commercially. If it ends up in something people read, link{" "}
            <a href="/">stonkpile.xyz</a>, and link rather than paste: a figure that moves every five
            minutes has to be cited to stay true.
          </p>
          <p className="lookfor">
            <span className="k">What the score is not</span>
            The rating measures the market around a token, never the company behind it. A 92 says
            you could get out, not that the stock is a good buy.
          </p>
        </div>
      </section>

      <footer>
        <span>
          <a href="/">The board</a> &middot; <a href="/api/index">JSON</a> &middot;{" "}
          <a href="/brand">Brand</a> &middot;{" "}
          <a href="https://github.com/DimiMili/stonkpile" target="_blank" rel="noopener noreferrer">GitHub</a>
        </span>
        <span>Open source, MIT. Not investment advice.</span>
      </footer>
    </div>
  );
}
