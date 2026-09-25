import type { Metadata } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Lookup } from "@/components/Lookup";
import { Copy } from "@/components/Copy";
import { Live } from "@/components/Live";
import { PLATFORM_TOKENS } from "@/lib/checks";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const idx = await buildIndex();
  // Hourly bucket keeps the URL warm. The suffix is a manual cache break:
  // X caches a refused fetch against the exact URL, so after the robots.txt
  // fix every image needed a URL their crawler had never seen.
  const v = `${Math.floor(Date.parse(idx.generatedAt) / 3_600_000)}r2`;
  const image = `${siteUrl}/api/card/board.png?v=${v}`;
  /* The card sells the same thing the page now promises. The image below still
     carries the board and its own line, because that is a caption on a chart
     rather than a second pitch: the title asks the question, the picture is the
     evidence that somebody has actually done the work. */
  const title = "Is this tokenized stock real?";
  const description =
    `Paste a ticker or a contract address. Who issued it, whether it trades at all, ` +
    `and what is priced against it. Every tokenized stock on Solana, across five issuers.`;
  return {
    openGraph: {
      title, description, type: "website", url: siteUrl,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

const usd = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(v / 1e6 >= 10 ? 1 : 2)}M`
  : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
  : `$${Math.round(v)}`;

const holders = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}k`;

const when = (ts?: number) =>
  ts ? new Date(ts * 1000).toUTCString().slice(0, 22) + " UTC" : "";

export default async function Page() {
  const idx = await buildIndex();
  const { totals: T, stocks, coins, marketSession: ms } = idx;

  const board = stocks.filter((s) => s.quotedCount > 0).slice(0, 25);
  const max = Math.max(...board.map((r) => r.quotedVolume24h), 1);
  const top = coins.slice(0, 40);
  const noFeed = stocks.filter((s) => s.quotedCount > 0 && !s.has247Feed);

  // The same company, tokenized by more than one issuer. Public companies agree
  // because a Pyth feed and an arbitrage path exist. Private ones have neither.
  const byUnderlying = new Map<string, typeof stocks>();
  for (const st of stocks) {
    if (st.price <= 0) continue;
    const arr = byUnderlying.get(st.underlying) ?? [];
    arr.push(st);
    byUnderlying.set(st.underlying, arr);
  }
  const dupes = [...byUnderlying.values()]
    .filter((rows) => new Set(rows.map((r) => r.issuer)).size > 1)
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => b.volume24h - a.volume24h);
      const prices = sorted.map((r) => r.price);
      const lo = Math.min(...prices), hi = Math.max(...prices);
      return { rows: sorted, gap: lo > 0 ? (hi - lo) / lo : 0 };
    })
    .sort((a, b) => b.gap - a.gap);
  const anyWide = dupes.some((d) => d.gap > 0.1);

  // One plain sentence per section. A glance should leave you with a fact,
  // not a description of what the table beneath is ranked by.
  const lead = board[0];
  const widest = dupes[0];
  const deadest = (["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"] as const)
    .map((iss) => ({
      iss,
      listed: T.byIssuer[iss] ?? 0,
      trade: stocks.filter((x) => x.issuer === iss).length,
    }))
    .filter((r) => r.listed > 20)
    .sort((a, b) => b.listed - b.trade - (a.listed - a.trade))[0];
  const topCoin = coins[0];
  const stamp = idx.generatedAt.slice(0, 16).replace("T", " ") + " UTC";

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          <span>Tokenized equities as quote assets</span>
          <span className="dot">/</span>
          <span>Solana</span>
          <span className="dot">/</span>
          {ms && (
            <span className={ms.isOpen ? "open" : "closed"}>
              NYSE {ms.isOpen ? "open" : "closed"}
            </span>
          )}
          <span className="dot">/</span>
          <Live generatedAt={idx.generatedAt} />
        </p>
        {/* The headline is the question people arrive with, not the argument the
            page goes on to make. First reader feedback was "I am not sure what I
            am supposed to do", and the fix is to answer that before anything
            else: ask their question, then hand them the box that answers it.
            The thesis moved down to the board, where the reading starts. */}
        <h1>
          Is this tokenized stock <em>real</em>?
        </h1>
        <p className="standfirst">
          Paste a ticker or a contract address. You get the issuer, whether it trades at
          all, and what is priced against it. Everything below is the whole market, if you
          want to read rather than look something up.
        </p>
      </header>

      <div id="check">
        <Lookup />
      </div>

      <nav className="jump" aria-label="Sections">
        <div className="jump-row">
          <a href="#issuers">Issuers</a>
          <a href="#board">Board</a>
          <a href="#coins">Coins</a>
          {dupes.length > 0 && <a href="#prices">Two prices</a>}
          <a href="#oracle">Oracle gap</a>
        </div>
      </nav>

      <div className="stats">
        <Stat k="Coins quoted in stocks" v={T.quotedCoins.toLocaleString()} />
        <Stat k="Their 24h volume" v={usd(T.quotedVolume24h)} />
        <Stat k="Tokenized stocks listed" v={T.universe.toLocaleString()} sub={`/ ${T.tradeable} traded`} />
        <Stat k="Holders of tokenized stock" v={holders(T.universeHolders)} />
      </div>

      <section id="issuers">
        <h2>Five issuers, very different shapes</h2>
        {deadest && (
          <p className="finding">
            <span className="nowtag">right now</span>
            {deadest.iss} lists <b>{deadest.listed.toLocaleString()}</b> tokenized stocks.{" "}
            <b>{deadest.trade}</b> of them trade.
          </p>
        )}
        <p className="lookfor">
          <span className="k">What to look for</span>
          The gap between listed and actually trades. A wide gap means most of that issuer&apos;s
          catalogue has no pool behind it, so you can buy it and then find there is nobody to
          sell it to. Used as denominators is the stricter test again: it means other people
          have built markets on top of that token.
        </p>
        <div className="issuers">
          {(["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"] as const).map((iss) => {
            // Sunrise is the brand the market knows; Backpack Securities is the
            // entity that actually issues, and what the token metadata says.
            const shown = iss === "Backpack" ? "Sunrise" : iss;
            const listed = T.byIssuer[iss] ?? 0;
            const rows = stocks.filter((s) => s.issuer === iss);
            const vol = rows.reduce((a, r) => a + r.quotedVolume24h, 0);
            const denoms = rows.filter((r) => r.quotedCount > 0).length;
            return (
              <div className="issuer" key={iss}>
                <p className="issuer-name">{shown}</p>
                <p className="issuer-sub">
                  {iss === "Backpack" ? "issued by Backpack Securities"
                    : iss === "xStocks" ? "issues the xStocks range"
                    : iss === "PreStocks" ? "pre-IPO equity"
                    : iss === "Tessera" ? "pre-IPO, tesseralab.co"
                    : "Ondo Finance"}
                </p>
                <div className="issuer-row"><span>Tokens listed</span><b>{listed.toLocaleString()}</b></div>
                <div className="issuer-row"><span>Actually trade</span><b>{rows.length}</b></div>
                <div className="issuer-row"><span>Used as denominators</span><b>{denoms}</b></div>
                <div className="issuer-row"><span>Quoted volume 24h</span><b>{usd(vol)}</b></div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="board">
        <h2>Wall Street is the denominator now</h2>
        {lead && (
          <p className="finding">
            <span className="nowtag">right now</span>
            The most-used stock on Solana is <b>{lead.underlying}</b>, with{" "}
            <b>{lead.quotedCount}</b> coins settling in it.
          </p>
        )}
        <p className="lookfor">
          <span className="k">What to look for</span>
          High volume against a low coin count means one pair is carrying the whole stock, so
          that volume disappears if the pair does. Many coins against low volume is a crowded,
          thin lane. If you are picking a denominator to launch against, the interesting rows
          are the ones near the bottom and the tickers that do not appear here at all.
          <b> 24/7</b> marks a stock with an always-on Pyth reference price.
        </p>
        <div className="board">
          {board.map((r) => (
            <div className="row" key={r.mint}>
              <div className="tick">
                {r.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="tick-icon" src={r.icon} alt="" width={20} height={20} loading="lazy" />
                )}
                <a href={`/s/${r.symbol}`} className="tickname"><b>{r.symbol}</b></a>
                <span>{r.name.replace(/ (xStock|- Backpack Securities|\(Ondo Tokenized\))/g, "")}</span>
                {r.has247Feed && <span className="badge on">24/7</span>}
              </div>
              <div className="cnt">
                <b>{r.quotedCount}</b> coin{r.quotedCount === 1 ? "" : "s"}
              </div>
              <div className="barwrap">
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${Math.max((r.quotedVolume24h / max) * 100, 1.5)}%` }}
                  />
                </div>
                <span className="lead"><span className="lead-k">top</span>{r.topCoin ?? "—"}</span>
              </div>
              <div className="vol">{usd(r.quotedVolume24h)}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="coins">
        <h2>Priced in equity</h2>
        {topCoin && (
          <p className="finding">
            <span className="nowtag">right now</span>
            The biggest coin denominated in equity is <b>{topCoin.coin}</b>, settling in{" "}
            <b>{topCoin.underlying}</b>.
          </p>
        )}
        <p className="lookfor">
          <span className="k">What to look for</span>
          Compare liquidity against 24h volume. Volume many times larger than the pool is
          churn rather than depth, and it usually means a handful of wallets trading with each
          other. Anything marked <b>platform</b> is a launchpad or treasury token, so its
          volume reflects that platform rather than demand for a coin. Each row carries the
          coin&rsquo;s contract address so you can copy the right one. It tells you which coin
          this is, nothing more: the issuer check on this site covers the tokenized stocks, not
          the coins quoted against them.
        </p>
        <p className="scroll-hint">Swipe the table sideways for liquidity and volume</p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Coin</th><th>Denominated in</th><th>Issuer</th>
                <th>Venue</th><th>Liquidity</th><th>24h volume</th><th>24h</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c, i) => {
                // Same coin, same denominator, second pool. Without the marker the
                // row reads as a duplicate rather than as another venue.
                const nth = top
                  .slice(0, i)
                  .filter((p) => p.coinMint === c.coinMint && p.stock === c.stock).length;
                return (
                <tr key={(c.coinMint ?? "") + c.stock + i}>
                  <td>
                    <span className="rank">{i + 1}</span>{" "}
                    <span className="coin">{c.coin}</span>
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="flag">platform</span>
                    )}
                    {nth > 0 && <span className="flag flag-quiet">pool {nth + 1}</span>}
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="coin-sub">{PLATFORM_TOKENS[c.coinMint]}</span>
                    )}
                    {/* only on a coin's first row: the address does not change
                        because it holds a second pool */}
                    {c.coinMint && nth === 0 && (
                      <span className="ca-cell">
                        <Copy value={c.coinMint} />
                      </span>
                    )}
                  </td>
                  <td><span className="denom">{c.stock}</span></td>
                  <td className="dex">{c.issuer}</td>
                  <td className="dex">{c.dex}</td>
                  <td className="num">{c.liquidityUsd ? usd(c.liquidityUsd) : "—"}</td>
                  <td className="num">{usd(c.volume24h)}</td>
                  <td
                    className="num"
                    style={{
                      color: c.priceChange24h > 0 ? "var(--up)"
                           : c.priceChange24h < 0 ? "var(--down)" : "var(--faint)",
                    }}
                  >
                    {c.priceChange24h
                      ? `${c.priceChange24h > 0 ? "+" : ""}${c.priceChange24h.toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {dupes.length > 0 && (
        <section id="prices">
          <h2>The same company, two prices</h2>
          {widest && (
            <p className="finding">
              <span className="nowtag">right now</span>
              Two issuers price <b>{widest.rows[0].underlying}</b> at{" "}
              <b>${widest.rows[0].price.toFixed(2)}</b> and{" "}
              <b>${widest.rows[widest.rows.length - 1].price.toFixed(2)}</b>. It is private, so
              there is no published price to check either against.
            </p>
          )}
          <p className="lookfor">
            <span className="k">What to look for</span>
            A green badge means the issuers agree, because a public share price exists and
            anyone selling it wrong gets arbitraged. A red badge means nobody can tell you
            which price is right, including the issuers. Some of a wide gap may be
            denomination rather than overcharging, and that is the problem: you cannot check.
          </p>
          <div className="dupes">
            {dupes.map((d) => {
              const pct = (d.gap * 100).toFixed(d.gap < 0.1 ? 1 : 0);
              return (
                <div className="dupe" key={d.rows[0].underlying}>
                  <div className="dupe-head">
                    <p className="dupe-name">{d.rows[0].underlying}</p>
                    <span className={`dupe-gap ${d.gap > 0.1 ? "wide" : "tight"}`}>
                      {pct}% apart
                    </span>
                  </div>
                  <div className="dupe-row h">
                    <span>Token</span>
                    <span>Issuer</span>
                    <span className="r">Price</span>
                    <span className="r hide-s">Liquidity</span>
                    <span className="r hide-s">24h volume</span>
                    <span className="r">Feed</span>
                  </div>
                  {d.rows.map((r) => (
                    <div className="dupe-row" key={r.mint}>
                      <b>{r.symbol}</b>
                      <span>{r.issuer}</span>
                      <span className="r">
                        <b>${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}</b>
                      </span>
                      <span className="r hide-s">{usd(r.liquidity)}</span>
                      <span className="r hide-s">{usd(r.volume24h)}</span>
                      <span className="r">{r.has247Feed ? "24/7" : "none"}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {anyWide && (
            <div className="callout">
              <b>Part of a wide gap may be denomination rather than disagreement.</b>{" "}
              One issuer&apos;s token can represent a different slice of a share than
              another&apos;s. That is the problem, not a caveat to it: for a private company
              there is no reference price published anywhere, so a buyer cannot tell which of
              the two they are looking at. For the public names on this list, they can.
            </div>
          )}
        </section>
      )}

      <section id="oracle">
        <h2>The oracle gap</h2>
        <p className="finding">
          <span className="nowtag">right now</span>
          <b>{T.denominators - T.with247Feed}</b> of the <b>{T.denominators}</b> stocks being
          used as money have no price after the closing bell.
        </p>
        <p className="lookfor">
          <span className="k">What to look for</span>
          Pyth publishes a session feed that stops at 16:00 ET and an always-on{" "}
          <b>Equity.Index</b> feed. If you hold a coin quoted in a stock without the always-on
          one, its overnight and weekend moves are being priced against nothing.
        </p>
        <div className="chips">
          {board.map((r) => (
            <span className={`chip${r.has247Feed ? " on" : ""}`} key={r.mint + "c"}>
              {r.underlying}
            </span>
          ))}
        </div>
        <div className="callout">
          <b>{noFeed.length} of the top denominators have no 24/7 reference price.</b>{" "}
          {noFeed.slice(0, 8).map((s) => s.symbol).join(", ")} all carry coins that trade
          around the clock with nothing to price them against once the closing bell goes.
          {ms && !ms.isOpen && ` The US market is shut right now. It reopens ${when(ms.nextOpen)}.`}
        </div>
      </section>

      <p className="footnote">
        <span className="live-dot" aria-hidden="true" />
        Everything marked <b>right now</b> on this page is read from live pools and recomputed
        at most every five minutes. This page refreshes itself while the tab is open, so you do
        not have to. Last rebuild {stamp}.
      </p>

      <p className="cards-cta">
        <b style={{ color: "var(--ink)" }}>Every stock here has its own page and its own live share card.</b>{" "}
        Click a ticker on the board, or <a href="/cards">see all the cards</a>.
      </p>

      <footer>
        <span>
          Sources: <a href="https://dev.jup.ag">Jupiter</a> ·{" "}
          <a href="https://docs.dexscreener.com/api/reference">DexScreener</a> ·{" "}
          <a href="https://docs.pyth.network">Pyth</a>. Keyless and public.{" "}
          <a href="/api/index">JSON API</a>
        </span>
        <span>Updated {stamp}</span>
      </footer>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <p className="k">{k}</p>
      <div className="v">
        {v}
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}
