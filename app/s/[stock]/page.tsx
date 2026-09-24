import type { Metadata } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Checks } from "@/components/Checks";
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
  const v = Math.floor(Date.parse(idx.generatedAt) / 3_600_000); // hourly bucket: keeps the URL warm
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
      </header>

      <Checks
        title={`Is ${stock.symbol} what it says it is?`}
        checks={stockChecks(stock)}
        note="Five arithmetic checks on the stock token itself, before you look at anything quoted against it."
      />

      <section>
        <h2>What is priced in it</h2>
        <p className="sec-note">
          Turnover is 24-hour volume divided by the liquidity behind it. Anything far above
          about 5x is churning faster than real demand usually does.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Coin</th><th>Venue</th><th>Liquidity</th><th>24h volume</th><th>Turnover</th><th>24h</th></tr>
            </thead>
            <tbody>
              {top.map((c, i) => (
                <tr key={(c.coinMint ?? "") + i}>
                  <td>
                    <span className="rank">{i + 1}</span> <span className="coin">{c.coin}</span>
                    {c.coinMint && PLATFORM_TOKENS[c.coinMint] && (
                      <span className="flag" title={PLATFORM_TOKENS[c.coinMint]}>platform</span>
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
              ))}
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

      <footer>
        <span>
          <a href="/">The full board</a> · <a href={`/api/card/${stock.symbol}.png`}>Share card</a> ·{" "}
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
