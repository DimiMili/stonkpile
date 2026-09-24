import type { Metadata } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Lookup } from "@/components/Lookup";
import { PLATFORM_TOKENS } from "@/lib/checks";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const idx = await buildIndex();
  const v = Math.floor(Date.parse(idx.generatedAt) / 3_600_000); // hourly bucket: keeps the URL warm
  const image = `${siteUrl}/api/card/board.png?v=${v}`;
  const title = "Wall Street is the denominator now.";
  const description =
    `${idx.totals.quotedCoins.toLocaleString()} coins on Solana are priced in tokenized ` +
    `stocks, not SOL. Live index across xStocks, Backpack and Ondo.`;
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
          <span>{stamp}</span>
        </p>
        <h1>
          Wall Street is <em>the denominator</em> now.
        </h1>
        <p className="standfirst">
          Memecoins on Solana are no longer priced in SOL. They are priced in GameStop,
          in Gold, in Lockheed Martin. This is every coin currently quoted against a
          tokenized stock, across all three issuers, and how much of it is real.
        </p>
      </header>

      <Lookup items={idx.lookup} />

      <div className="stats">
        <Stat k="Coins quoted in stocks" v={T.quotedCoins.toLocaleString()} />
        <Stat k="Their 24h volume" v={usd(T.quotedVolume24h)} />
        <Stat k="Stock tokens listed" v={T.universe.toLocaleString()} sub={`/ ${T.tradeable} traded`} />
        <Stat k="Holders of tokenized stock" v={(T.universeHolders / 1000).toFixed(0) + "k"} />
      </div>

      <section>
        <h2>Three issuers, very different shapes</h2>
        <p className="sec-note">
          Every tokenized stock on Solana comes from one of three issuers, and they are not
          alike. Backpack has the fewest tokens and the most action.
        </p>
        <div className="issuers">
          {(["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"] as const).map((iss) => {
            const listed = T.byIssuer[iss] ?? 0;
            const rows = stocks.filter((s) => s.issuer === iss);
            const vol = rows.reduce((a, r) => a + r.quotedVolume24h, 0);
            const denoms = rows.filter((r) => r.quotedCount > 0).length;
            return (
              <div className="issuer" key={iss}>
                <p className="issuer-name">{iss}</p>
                <p className="issuer-sub">
                  {iss === "Backpack" ? "issues the Sunrise range"
                    : iss === "xStocks" ? "issued by Backed"
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

      <section>
        <h2>The denominator board</h2>
        <p className="sec-note">
          Ranked by the 24-hour volume of coins quoted against each stock. The name beside the
          bar is the largest coin using that stock as its unit of account. <b>24/7</b> marks a
          stock with an always-on Pyth reference price.
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
                <span className="lead">{r.topCoin ?? "—"}</span>
              </div>
              <div className="vol">{usd(r.quotedVolume24h)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Priced in equity</h2>
        <p className="sec-note">
          The forty largest coins by 24-hour volume, each with the stock it settles in.
          Anything marked <b>platform</b> is a launchpad or treasury token rather than an
          independent coin, so its volume reflects that platform, not demand for a memecoin.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Coin</th><th>Denominated in</th><th>Issuer</th>
                <th>Venue</th><th>Liquidity</th><th>24h volume</th><th>24h</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c, i) => (
                <tr key={(c.coinMint ?? "") + c.stock + i}>
                  <td>
                    <span className="rank">{i + 1}</span>{" "}
                    <span className="coin">{c.coin}</span>
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="flag" title={PLATFORM_TOKENS[c.coinMint]}>platform</span>
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dupes.length > 0 && (
        <section>
          <h2>The same company, two prices</h2>
          <p className="sec-note">
            Some companies are tokenized by more than one issuer. Where the company is public,
            the issuers agree almost exactly: there is a Pyth feed and a real market to
            arbitrage against. Where it is private, there is neither, and the prices come apart.
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

      <section>
        <h2>The oracle gap</h2>
        <p className="sec-note">
          Pyth publishes two feeds per ticker: a session feed that stops at 16:00 ET, and an
          always-on <b>Equity.Index</b> feed. Only {T.with247Feed} of the {T.denominators} stocks
          being used as denominators have the always-on one.
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
