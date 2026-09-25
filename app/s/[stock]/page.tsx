import type { Metadata } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Checks } from "@/components/Checks";
import { Share } from "@/components/Share";
import { Copy } from "@/components/Copy";
import { stockChecks, coinChecks, worst, PLATFORM_TOKENS } from "@/lib/checks";

export const revalidate = 300;

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

const clean = (s: string) =>
  s.replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "").trim();

async function find(key: string) {
  const idx = await buildIndex();
  const k = key.toUpperCase();
  return {
    idx,
    stock: idx.stocks.find((s) => s.symbol.toUpperCase() === k || s.underlying === k),
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ stock: string }> },
): Promise<Metadata> {
  const { stock: raw } = await params;
  const { idx, stock } = await find(raw);

  if (!stock || stock.quotedCount === 0) {
    return {
      title: "Stonkpile",
      description: "Every memecoin on Solana quoted against a tokenized stock.",
    };
  }

  const name = clean(stock.name);
  const title = `${stock.quotedCount} coins are priced in ${name}`;
  const description =
    `${stock.quotedCount} memecoins on Solana are quoted against ${stock.symbol}, ` +
    `doing ${usd(stock.quotedVolume24h)} in 24h volume. ` +
    (stock.topCoin ? `Biggest is ${stock.topCoin}. ` : "") +
    (stock.has247Feed ? "" : `${stock.underlying} has no 24/7 reference price.`);
  /* Version the image URL by the index timestamp. Social crawlers cache per
     image URL, so a fixed path means a single failed fetch is cached forever
     and a stale card is served after the data moves. This changes every
     refresh, which gives them a fresh URL to fetch. */
  // Daily bucket, not hourly. Every rollover makes a URL nobody has rendered
  // yet, and that first render takes about three seconds, which is long enough
  // for a social crawler to give up and cache the miss against it. Hourly meant
  // 24 chances a day to burn a card; daily means one, and it can be warmed by
  // hand after a deploy. The suffix is the manual break for when we need a URL
  // their crawler has never seen at all.
  const v = `${Math.floor(Date.parse(idx.generatedAt) / 86_400_000)}r3`;
  const image = `${siteUrl}/api/card/${stock.symbol}.png?v=${v}`;

  return {
    title,
    description,
    openGraph: {
      title, description, type: "website",
      url: `${siteUrl}/s/${stock.symbol}`,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage(
  { params }: { params: Promise<{ stock: string }> },
) {
  const { stock: raw } = await params;
  const { idx, stock } = await find(raw);

  if (!stock || stock.quotedCount === 0) {
    const avail = idx.stocks.filter((s) => s.quotedCount > 0).slice(0, 16);
    return (
      <div className="wrap">
        <header>
          <p className="eyebrow"><span>Stonkpile</span></p>
          <h1>Nothing is priced in <em>{raw.toUpperCase()}</em>.</h1>
          <p className="standfirst">
            {idx.totals.denominators} tokenized stocks are currently being used as quote
            assets on Solana. That is not one of them.
          </p>
        </header>
        <section>
          <div className="chips">
            {avail.map((s) => (
              <a className="chip" key={s.mint} href={`/s/${s.symbol}`}>{s.symbol}</a>
            ))}
          </div>
        </section>
        <footer><span><a href="/">The full board</a></span></footer>
      </div>
    );
  }

  const top = stock.quotedCoins.slice(0, 10);
  // One coin can hold several pools against the same stock, so dedupe by mint
  // or the note repeats itself once per pool.
  const platforms = [
    ...new Map(
      top
        .filter((c) => c.coinMint && PLATFORM_TOKENS[c.coinMint])
        .map((c) => [c.coinMint!, { coin: c.coin, label: PLATFORM_TOKENS[c.coinMint!] }]),
    ).values(),
  ];

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          <span>Stonkpile</span>
          <span className="dot">/</span>
          <span>{stock.issuer}</span>
          {!stock.has247Feed && (
            <>
              <span className="dot">/</span>
              <span className="closed">no 24/7 oracle</span>
            </>
          )}
        </p>
        <h1>
          {stock.quotedCount} coins are priced in <em>{clean(stock.name)}</em>.
        </h1>
        <p className="standfirst">
          {stock.symbol} is doing {usd(stock.quotedVolume24h)} of 24-hour volume as a quote
          asset, across {usd(stock.quotedLiquidity)} of liquidity. These are the coins using
          it as their unit of account.
        </p>
        {/* The address, on the page that says why this is the right one. The
            explorer link is the point: copying from us means trusting us, and
            one tap to check beats asking anybody to take our word. */}
        <p className="ca-line">
          <span className="k">{stock.symbol} contract</span>
          <Copy value={stock.mint} label="copy address" />
          <a
            href={`https://solscan.io/token/${stock.mint}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            check it on Solscan
          </a>
        </p>
      </header>

      <Checks
        title={`Is ${stock.symbol} what it says it is?`}
        checks={stockChecks(stock)}
        note="Five arithmetic checks on the tokenized stock itself, before you look at anything quoted against it."
      />

      <section>
        <h2>What is priced in it</h2>
        <p className="sec-note">
          Turnover is 24-hour volume divided by the liquidity behind it. Anything far above
          about 5x is churning faster than real demand usually does. Each row carries the
          coin&rsquo;s contract address so you can copy the right one. It identifies the coin
          and says nothing about whether it is any good.
        </p>
        {/* Named outright rather than left to a tooltip. On some stocks a launchpad's
            own token is the largest thing quoted against them, which makes the headline
            volume read as demand for a coin when it is the platform trading itself. */}
        {platforms.length > 0 && (
          <p className="sec-note platform-note">
            {platforms.map((p, i) => (
              <span key={p.coin}>
                {i > 0 && " "}
                <b>{p.coin}</b> is the {p.label}, not an independent memecoin.
              </span>
            ))}{" "}
            The volume is real, it just belongs to a platform rather than to a coin anyone is
            buying. It is counted in the {usd(stock.quotedVolume24h)} above; read that number
            with this in mind.
          </p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Coin</th><th>Venue</th><th>Liquidity</th><th>24h volume</th><th>Turnover</th><th>24h</th></tr>
            </thead>
            <tbody>
              {top.map((c, i) => {
                // A row is a pool, not a coin. Some coins hold several against the
                // same stock, and the same name appearing twice looks like a bug
                // unless the table says which it is.
                const nth = top.slice(0, i).filter((p) => p.coinMint === c.coinMint).length;
                return (
                <tr key={(c.coinMint ?? "") + i}>
                  <td>
                    <span className="rank">{i + 1}</span> <span className="coin">{c.coin}</span>
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="flag">platform</span>
                    )}
                    {nth > 0 && <span className="flag flag-quiet">pool {nth + 1}</span>}
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="coin-sub">{PLATFORM_TOKENS[c.coinMint]}</span>
                    )}
                    {c.coinMint && nth === 0 && (
                      <span className="ca-cell">
                        <Copy value={c.coinMint} />
                      </span>
                    )}
                  </td>
                  <td className="dex">{c.dex}</td>
                  <td className="num">{c.liquidityUsd ? usd(c.liquidityUsd) : "—"}</td>
                  <td className="num">{usd(c.volume24h)}</td>
                  <td className="num" style={{ color: turnLevel(c) }}>
                    {c.liquidityUsd > 0 ? `${(c.volume24h / c.liquidityUsd).toFixed(1)}x` : "—"}
                  </td>
                  <td className="num" style={{
                    color: c.priceChange24h > 0 ? "var(--up)"
                         : c.priceChange24h < 0 ? "var(--down)" : "var(--faint)",
                  }}>
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

      {top[0] && (
        <Checks
          title={`The biggest one: ${top[0].coin}`}
          checks={coinChecks(top[0])}
          note={`${top[0].coin} is the largest coin quoted against ${stock.symbol} right now. Same checks, applied to it.`}
        />
      )}

      <Share
        url={`${siteUrl}/s/${stock.symbol}`}
        card={`/api/card/${stock.symbol}.png`}
        text={`${stock.quotedCount} coin${stock.quotedCount === 1 ? "" : "s"} on Solana are priced in ${stock.name.replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "").trim()} stock, not SOL.`}
      />

      <footer>
        <span>
          <a href="/">The full board</a> · <a href="/cards">All cards</a> ·{" "}
          <a href={`/api/index?stock=${stock.symbol}`}>JSON</a>
        </span>
        <span>Updated {idx.generatedAt.slice(0, 16).replace("T", " ")} UTC</span>
      </footer>
    </div>
  );
}

function turnLevel(c: { volume24h: number; liquidityUsd: number }) {
  if (c.liquidityUsd <= 0) return "var(--down)";
  const t = c.volume24h / c.liquidityUsd;
  return t <= 5 ? "var(--muted)" : t <= 20 ? "var(--brass)" : "var(--down)";
}
