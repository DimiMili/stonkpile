import type { Metadata } from "next";
import { Wordmark } from "@/components/SiteMark";
import { Brand } from "@/components/Brand";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Checks } from "@/components/Checks";
import { RatingCard } from "@/components/Rating";
import { Share } from "@/components/Share";
import { Copy } from "@/components/Copy";
import { Venues } from "@/components/Venues";
import { stockChecks, coinChecks, worst, PLATFORM_TOKENS } from "@/lib/checks";
import { bandLabel, bandLetter, isRated } from "@/lib/rating";

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
    /* Exact symbol first, then the underlying. Several companies are tokenized
       by more than one issuer, so matching either one in array order hands
       /s/SPCX to whichever row happened to be sorted higher. */
    stock:
      idx.stocks.find((s) => s.symbol.toUpperCase() === k) ??
      idx.stocks.find((s) => s.underlying === k),
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ stock: string }> },
): Promise<Metadata> {
  const { stock: raw } = await params;
  const { idx, stock } = await find(raw);

  if (!stock) {
    return {
      title: "Stonkpile",
      description: "Every tokenized stock on Solana, rated.",
    };
  }

  const name = clean(stock.name);
  const r = stock.rating;

  /* The title and the card are the only parts of this page most people see, so
     they say the rating rather than the memecoin count. That count was the
     subject when this site was Ticker Wars; it is now one section of several,
     and leading with it meant every link we posted sold the old product. */
  const title = isRated(r)
    ? `${name} rates ${bandLetter(r.band)} ${bandLabel(r.band)}, ${r.score} out of 100`
    : `${name} on Solana is not rated`;
  const description = isRated(r)
    ? `${stock.symbol} from ${stock.issuer} scores ${r.score}: ` +
      r.pillars.map((p) => `${p.label.toLowerCase()} ${p.score.toFixed(1)}`).join(", ") +
      `. ${usd(stock.liquidity)} of liquidity behind it.` +
      (stock.has247Feed ? "" : ` No 24/7 reference price.`)
    : (r && "reason" in r ? r.reason : "Nothing here to measure yet.");
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
  const v = `${Math.floor(Date.parse(idx.generatedAt) / 86_400_000)}r5`;
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

  /* Only a ticker nobody has issued is a dead end now.
     This used to turn away any stock with no memecoins quoted against it,
     which quietly hid nine rated tokens: INTC rates Sound on $88k of
     liquidity and its page said "Nothing is priced in INTC" with a list of
     other tickers. The memecoin count is a section of this page, not the
     condition for having one. */
  if (!stock) {
    const k = raw.toUpperCase();
    /* A listing with no pool is not in idx.stocks, but it is in the lookup,
       and it is a real token somebody is holding. Telling them nothing on
       Solana is called that would be a false statement about an asset that
       exists; what is true is that nobody has funded a market behind it. */
    /* The token actually called that wins over a token merely tracking that
       company. Two issuers tokenize Galaxy Digital, xStocks as GLXYx and
       Superstate as GLXY, and matching either in array order meant /s/GLXY
       served the xStocks token and Superstate's had no reachable page at all. */
    const stocksOnly = idx.lookup.filter((e) => e.kind === "stock");
    const listed =
      stocksOnly.find((e) => e.symbol.toUpperCase() === k) ??
      stocksOnly.find((e) => e.underlying === k);
    const avail = idx.stocks.filter((s) => isRated(s.rating)).slice(0, 16);
    return (
      <div className="wrap">
        <header>
          <p className="eyebrow">
            <Wordmark size={19} />
            {listed?.issuer && (
              <>
                <span className="dot">/</span>
                <span>{listed.issuer}</span>
              </>
            )}
          </p>
          {listed ? (
            <>
              <h1><em>{listed.name || listed.symbol}</em> has no market behind it.</h1>
              <p className="standfirst">
                {listed.symbol} is issued and verified, and nobody has funded a pool
                against it, so there is nothing here to rate.{" "}
                {idx.totals.universe.toLocaleString()} tokenized stocks are listed on
                Solana and {idx.totals.tradeable} of them have a market.
              </p>
              <p className="ca-line">
                <span className="k">{listed.symbol} contract</span>
                <Copy value={listed.mint} label="copy address" />
                <a
                  href={`https://solscan.io/token/${listed.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  check it on Solscan
                </a>
              </p>
            </>
          ) : (
            <>
              <h1>Nothing on Solana is called <em>{k}</em>.</h1>
              <p className="standfirst">
                {idx.totals.universe.toLocaleString()} tokenized stocks are listed on
                Solana and {idx.totals.tradeable} of them have a market. That ticker is
                not one of them, under that name.
              </p>
            </>
          )}
        </header>
        <section>
          <h2>These are rated</h2>
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

  /* What gets typed into the post. The card carries the breakdown, so this is
     the verdict and the number, not a second copy of the table. */
  const shareText = isRated(stock.rating)
    ? `${clean(stock.name)} rates ${bandLetter(stock.rating.band)} ` +
      `${bandLabel(stock.rating.band).toLowerCase()} on Stonkpile, ` +
      `${stock.rating.score} out of 100 for the market around it.`
    : `${clean(stock.name)} is listed on Solana and has no market behind it worth rating.`;

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
          {/* The wordmark is the only thing on a ticker page that looks like a
              way back, so it had better be one. */}
          <Wordmark size={19} />
          <span className="dot">/</span>
          {/* The issuer carries its own mark here, not just its name. On a page
              whose whole job is telling you whether a token is the genuine one,
              the issuer is the single most load-bearing fact, and a logo is
              recognised before a word is read. Same component, same files, same
              lettered fallback as everywhere else on the site. */}
          <Brand name={stock.issuer} size={15} label />
          {!stock.has247Feed && (
            <>
              <span className="dot">/</span>
              <span className="closed">no 24/7 oracle</span>
            </>
          )}
        </p>
        {isRated(stock.rating) ? (
          <>
            <h1>
              <em>{clean(stock.name)}</em> rates {bandLetter(stock.rating.band)}{" "}
              {bandLabel(stock.rating.band)}.
            </h1>
            <p className="standfirst">
              {stock.rating.score} out of 100 for the market around {stock.symbol}:{" "}
              {usd(stock.liquidity)} you can sell into,{" "}
              {usd(stock.volume24h)} of volume in a day, {stock.venues.length} pool
              {stock.venues.length === 1 ? "" : "s"}
              {stock.perpVenues.length > 0
                ? ` and a perp on ${stock.perpVenues.map((p) => p.name).join(" and ")}`
                : " and no perp"}
              . It rates the market, never the company.
            </p>
          </>
        ) : (
          <>
            <h1>
              <em>{clean(stock.name)}</em> is not rated.
            </h1>
            <p className="standfirst">
              {"reason" in (stock.rating ?? {})
                ? (stock.rating as { reason: string }).reason
                : "Nothing here to measure yet."}{" "}
              {stock.quotedCount > 0 &&
                `${stock.quotedCount} coins are priced in it even so.`}
            </p>
          </>
        )}
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

      {/* The headline states the verdict, so the working comes next and the
          share block sits under it. The five checks used to run first, which
          put a detour between the claim and the evidence for it, and left the
          share block about four screens down a phone. A share button nobody
          scrolls to is the same as no share button. */}
      <RatingCard symbol={stock.symbol} rating={stock.rating} issuer={stock.issuer} />

      <Share
        url={`${siteUrl}/s/${stock.symbol}`}
        card={`/api/card/${stock.symbol}.png`}
        text={shareText}
      />

      {/* The rating says how good the market is. This says whether the token is
          the real one, which is a different question and the gate the rating
          applies before it scores anything. */}
      <Checks
        title={`Is ${stock.symbol} what it says it is?`}
        checks={stockChecks(stock)}
        note="Five arithmetic checks on the tokenized stock itself, before you look at anything quoted against it."
      />

      {/* Deliberately below the checks. The page tells you whether this is the
          real token before it tells you where to buy it. */}
      <Venues
        symbol={stock.symbol}
        issuer={stock.issuer}
        pools={stock.pools}
        perpVenues={stock.perpVenues}
        liquidity={stock.liquidity}
      />

      {stock.quotedCount > 0 && (
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
      )}

      {top[0] && (
        <Checks
          title={`The biggest one: ${top[0].coin}`}
          checks={coinChecks(top[0])}
          note={`${top[0].coin} is the largest coin quoted against ${stock.symbol} right now. Same checks, applied to it.`}
        />
      )}

      <footer>
        <span>
          <a href="/">The full board</a> · <a href="/docs">Docs</a> ·{" "}
          <a href="/cards">All cards</a> · <a href="/brand">Brand</a> ·{" "}
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
