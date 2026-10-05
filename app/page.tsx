import type { Metadata } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Brand } from "@/components/Brand";
import { ToTop } from "@/components/ToTop";
import { SectionNav } from "@/components/SectionNav";
import { Lookup } from "@/components/Lookup";
import { Copy } from "@/components/Copy";
import { Spark } from "@/components/Spark";
import { Reveal } from "@/components/Reveal";
import { Churn, type ChurnPoint } from "@/components/Churn";
import { history, hasHistory, series, since } from "@/lib/history";
import { Live } from "@/components/Live";
import { RatingChip } from "@/components/Rating";
import { REDEMPTION } from "@/lib/redemption";
import { BANDS } from "@/lib/rating";
import { churnPoints as churn, accrualRows, splitRows, ratedRows } from "@/lib/sections";
import { PLATFORM_TOKENS } from "@/lib/checks";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const idx = await buildIndex();
  // Daily bucket, not hourly. Every rollover makes a URL nobody has rendered
  // yet, and that first render takes about three seconds, which is long enough
  // for a social crawler to give up and cache the miss against it. Hourly meant
  // 24 chances a day to burn a card; daily means one, and it can be warmed by
  // hand after a deploy. The suffix is the manual break for when we need a URL
  // their crawler has never seen at all.
  const v = `${Math.floor(Date.parse(idx.generatedAt) / 86_400_000)}r4`;
  const image = `${siteUrl}/api/card/board.png?v=${v}`;
  /* The card sells the same thing the page now promises. The image below still
     carries the board and its own line, because that is a caption on a chart
     rather than a second pitch: the title asks the question, the picture is the
     evidence that somebody has actually done the work. */
  const title = "Is this tokenized stock real?";
  const description =
    `Paste a ticker or a contract address. Who issued it, whether it has a market, ` +
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

const clean = (s: string) =>
  s.replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\)|PreStocks)\s*/gi, "").trim();

const holders = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}k`;

const when = (ts?: number) =>
  ts ? new Date(ts * 1000).toUTCString().slice(0, 22) + " UTC" : "";

/**
 * How many times a pool traded its own contents in a day.
 *
 * Volume is the cheapest number on this site to fake and depth is the most
 * expensive, so ranking by volume alone hands the top of the table to whoever
 * is willing to run a bot. This puts the ratio next to it. Across the board
 * the median is a little over one turn a day, so ten is already strange and
 * the bar is scaled against that rather than against the worst offender, which
 * would flatten everything honest into nothing.
 */
const HOT = 10;
function turnCell(volume: number, liquidity: number) {
  if (!(liquidity > 0) || !(volume > 0)) return <span className="turn">—</span>;
  const t = volume / liquidity;
  const pct = Math.min(100, (Math.log10(Math.max(t, 0.1)) + 1) * 33);
  return (
    <span className={`turn${t >= HOT ? " hot" : ""}`}>
      <span className="turn-n">{t >= 10 ? Math.round(t) : t.toFixed(1)}x</span>
      <span className="turn-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

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
  /* Compare price per underlying share, not price per token.
     One token is not always one share. SpaceX ran a 5-for-1 before listing and
     Tessera did not re-mint, so their token is still five shares; comparing the
     sticker prices made a denomination look like a 258% disagreement and put
     the loudest wrong number on the site. Dividing by shares-per-token first
     turns that into what it actually is: two pre-IPO issuers landing within 1%
     of each other and both sitting well under the listed price. */
  const perShare = (r: (typeof stocks)[number]) =>
    r.price / (r.sharesPerToken > 0 ? r.sharesPerToken : 1);

  const dupes = [...byUnderlying.values()]
    .filter((rows) => new Set(rows.map((r) => r.issuer)).size > 1)
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => b.volume24h - a.volume24h);
      const prices = sorted.map(perShare);
      const lo = Math.min(...prices), hi = Math.max(...prices);
      return {
        rows: sorted,
        gap: lo > 0 ? (hi - lo) / lo : 0,
        /* Worth saying out loud when it applies, because a reader who knows the
           sticker prices will otherwise think the number is wrong. */
        normalised: sorted.some((r) => r.sharesPerToken !== 1),
      };
    })
    .sort((a, b) => b.gap - a.gap);
  const anyWide = dupes.some((d) => d.gap > 0.1);

  // One plain sentence per section. A glance should leave you with a fact,
  // not a description of what the table beneath is ranked by.
  const lead = board[0];
  const widest = dupes[0];
  /* Ranked by money per listed token, not by the size of the gap in counts.
     Counting picks the issuer with the biggest catalogue; what the reader wants
     is the one whose catalogue is emptiest, and that is a liquidity question. */
  const deadest = (["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"] as const)
    .map((iss) => {
      const d = T.byIssuerDepth[iss];
      return {
        iss,
        shown: iss === "Backpack" ? "Sunrise" : iss,
        listed: T.byIssuer[iss] ?? 0,
        liquidity: d?.liquidity ?? 0,
        withPool: d?.withPool ?? 0,
        perToken: d && d.listed ? d.liquidity / d.listed : Infinity,
      };
    })
    .filter((r) => r.listed > 20)
    .sort((a, b) => a.perToken - b.perToken)[0];
  const topCoin = coins[0];

  /* The standouts. Everything on this page ranks coins quoted against a stock,
     which meant the most basic fact about the category, where the money is,
     could not be found on the site at all. These are computed fresh every
     rebuild rather than written by hand, so they cannot go stale or flatter. */
  const depth = T.byIssuerDepth;
  const totalLiq = Object.values(depth).reduce((a, d) => a + d.liquidity, 0);
  const byLiq = [...stocks].sort((a, b) => b.liquidity - a.liquidity);

  /* The rated board. Only stocks with a market are rated at all, so this is the
     same 113 rows the depth table ranks, ordered by the opinion instead of by
     the money. Sorting by score rather than by size is the whole point: the
     biggest pool is not automatically the best market, and this is the one
     ranking on the site where that can show. */
  const rated = ratedRows(stocks);
  const bandCount = T.ratings;
  const bestRated = rated[0];
  const worstRated = rated[rated.length - 1];

  /* Every pool with both numbers, stocks and the coins quoted against them in
     one cloud. A $1k floor keeps dust out: a pool with eleven dollars in it can
     post an absurd ratio on a single trade, and that is noise rather than a
     finding. */
  const churnPoints: ChurnPoint[] = churn(idx);
  const accrual = accrualRows(stocks);
  const splits = splitRows(stocks);
  const topAccrual = accrual[0];

  const churnLead = [...churnPoints].sort(
    (a, b) => b.volume / b.liquidity - a.volume / a.liquidity,
  )[0];
  const heaviest = byLiq[0];
  const runnerUp = byLiq[1];
  const top10 = byLiq.slice(0, 10).reduce((a, r) => a + r.liquidity, 0);
  const top10Share = totalLiq > 0 ? Math.round((top10 / totalLiq) * 100) : 0;
  const fresh48 = coins.filter(
    (c) => c.createdAt && Date.now() - c.createdAt < 172_800_000,
  ).length;
  const stamp = idx.generatedAt.slice(0, 16).replace("T", " ") + " UTC";

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          <span>Every tokenized stock on Solana</span>
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
        {/* Three questions, set at two sizes rather than three lines of the same
            one. The first is the one a stranger arrives with and it keeps the
            full headline weight; the other two are the follow-ups somebody has
            once they believe the first, so they sit underneath at a size that
            reads as a continuation rather than as a second headline. Set flat at
            38px all three would be four lines of Bodoni on a phone, which is the
            wall of text we spent yesterday removing. */}
        <h1>
          Is this tokenized stock <em>real</em>?
        </h1>
        <p className="h1-more">
          Is anyone actually buying it? Does it have perps?
        </p>
        <p className="standfirst">
          Check by ticker or CA. View all tokenized stocks and the memecoins paired
          with them: 1,800 listings, 112 with liquidity, five issuers, gaps between
          them.
        </p>
      </header>

      {/* Above the search box, not below it. The shortcuts exist so somebody
          landing here can see the page has parts and jump to one; sitting them
          under the box and the findings meant you only met them after scrolling
          past the two things they were meant to help you skip. */}
      <SectionNav />

      <section className="standout" aria-label="Findings">
        <p className="standout-k">Findings</p>
        <ul>
          {heaviest && (
            <li>
              The most liquid tokenized stock on Solana is <b>{clean(heaviest.name)}</b>, with{" "}
              <b>{usd(heaviest.liquidity)}</b> behind it
              {runnerUp ? <>, ahead of {clean(runnerUp.name)} on {usd(runnerUp.liquidity)}</> : null}.
            </li>
          )}
          <li>
            <b>{top10Share}%</b> of all the liquidity in the category sits in ten tokens, out of{" "}
            <b>{T.universe.toLocaleString()}</b> that exist.
          </li>
          {deadest && (
            <li>
              {deadest.shown} lists <b>{deadest.listed.toLocaleString()}</b> tokenized stocks.{" "}
              <b>{deadest.withPool}</b> of them have a pool.
            </li>
          )}
          {fresh48 > 0 && (
            <li>
              <b>{fresh48}</b> new pools opened against a tokenized stock in the last 48 hours.
            </li>
          )}
        </ul>
        <p className="standout-note">
          Worked out from the index each time this page rebuilds, not written by hand.{" "}
          <a href="#depth">The whole ranking</a>.
        </p>
      </section>


      {/* The only part of this site that knows what yesterday looked like. A daily
          job appends one record to the repo, so the history is public and sits in
          git next to the code that produced it. Until a few days have accumulated
          there is nothing honest to draw, and this says so rather than inventing a
          trend from one measurement. */}
      <section id="history">
        <h2>Tokenized stocks on Solana, over time</h2>
        <Reveal label="Show the charts" count={`${history.length} daily records`} peek={280}>
        {hasHistory ? (
          <>
            <p className="lookfor">
              <span className="k">What to look for</span>
              Direction, not the level. A category growing its liquidity is being funded;
              one adding tokens while liquidity sits still is adding listings. One record a
              day, taken after the US close.
            </p>
            <div className="sparks">
              <Spark label="Liquidity, whole category" points={series((s) => s.liquidity)} format="usd" />
              <Spark label="Tokenized stocks listed" points={series((s) => s.universe)} format="count" />
              <Spark label="With a pool above $5k" points={series((s) => s.withPool)} format="plain" />
              <Spark label="Coins priced in stocks" points={series((s) => s.quotedCoins)} format="count" />
              <Spark label="Holders" points={series((s) => s.holders)} format="people" />
              <Spark label="Used as a quote asset" points={series((s) => s.denominators)} format="plain" />
            </div>
          </>
        ) : (
          <p className="collecting">
            Collecting. One record a day lands in the repo after the US close, and these
            charts fill in as it goes.{" "}
            {since ? <>First reading {since}.</> : <>The first lands tonight.</>}{" "}
            Nothing is drawn until there is something real to draw, because a trend line
            through one measurement is a lie.
          </p>
        )}
        </Reveal>
      </section>

      {/* Where the money is. Every other table here ranks coins quoted against a
          stock; this one ranks the stocks themselves by the money standing
          behind them, which is the question a newcomer actually arrives with. */}
      <div className="stats">
        <Stat k="Coins quoted in stocks" v={T.quotedCoins.toLocaleString()} />
        <Stat k="Their 24h volume" v={usd(T.quotedVolume24h)} />
        <Stat k="Tokenized stocks listed" v={T.universe.toLocaleString()} sub={`/ ${T.tradeable} with a market`} />
        <Stat k="Holders of tokenized stock" v={holders(T.universeHolders)} />
      </div>

      <div id="check">
        <Lookup />
      </div>

      {/* The opinion. Everything above and below this reports; this is the one
          section that forms a judgment, so it carries its arithmetic in public
          and names what it refuses to judge. */}
      {rated.length > 0 && bestRated && worstRated && (
        <section id="rating">
          <h2>What the rating says</h2>
          <p className="finding">
            <span className="nowtag">right now</span>
            <b>{bandCount.prime}</b> of the {rated.length} markets here rate Prime and{" "}
            <b>{bandCount.fragile}</b> rate Fragile. The best is{" "}
            <b>{clean(bestRated.row.name) || bestRated.row.symbol}</b> on{" "}
            <b>{bestRated.rating.score}</b>. The other{" "}
            <b>{bandCount.unrated.toLocaleString()}</b> listings are unrated, because nothing
            was ever funded behind them.
          </p>
          <p className="lookfor">
            <span className="k">What is rated, and how</span>
            Every tokenized stock on Solana with a market gets one: all five issuers, no
            applications, nobody paying to be in it. The memecoins priced against these stocks
            are not rated here, because a coin is a different question and belongs on a
            different scale.
            <br />
            <br />
            What it judges is the market around a token, never the company behind it and never
            whether the price is fair. Four parts, each scored out of 10, each carrying its own
            weight. Ten across all four is exactly 100, so you can add it up yourself.
          </p>
          <ul className="rt-key">
            <li>
              <b>Liquidity</b><span className="rt-wt">&times;4</span>
              <span>How much you can sell into before you move the price.</span>
            </li>
            <li>
              <b>Real volume</b><span className="rt-wt">&times;2.5</span>
              <span>A pool nobody trades and a pool doing 80 times its own size in a day both fail.</span>
            </li>
            <li>
              <b>Exits</b><span className="rt-wt">&times;2</span>
              <span>More than one pool to sell into, and a perp to hedge or short with.</span>
            </li>
            <li>
              <b>Pricing</b><span className="rt-wt">&times;1.5</span>
              <span>A price after the US close, and other issuers agreeing on it per share.</span>
            </li>
          </ul>
          <p className="rt-gate">Not rated: a token that fails the issuer check, or one with no market at all.</p>
          <p className="rt-gate">Never rated on: the company, or whether the price is fair.</p>
          <Reveal label="Show the rated board" count={`${rated.length} rated`} peek={260}>
            <p className="scroll-hint">Swipe the table sideways for the four parts of the score</p>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Company</th><th>Token</th><th>Issuer</th><th>Rating</th><th>Redeem for</th>
                    <th>Liquidity</th><th>Real volume</th><th>Exits</th><th>Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {rated.slice(0, 20).map(({ row, rating }, i) => (
                    <tr key={row.mint}>
                      <td>
                        <span className="rank">{i + 1}</span>{" "}
                        {row.icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="tick-icon" src={row.icon} alt="" width={18} height={18} loading="lazy" />
                        )}
                        <span className="coin">{clean(row.name) || row.symbol}</span>
                      </td>
                      <td><a className="denom" href={`/s/${row.symbol}`}>{row.symbol}</a></td>
                      <td className="dex"><Brand name={row.issuer} size={16} label /></td>
                      <td><RatingChip rating={rating} /></td>
                      <td className="dex">
                        <span className={`rd-tag rd-${REDEMPTION[row.issuer].claim}`}>
                          {REDEMPTION[row.issuer].claim === "unstated"
                            ? "not stated"
                            : REDEMPTION[row.issuer].claim}
                        </span>
                      </td>
                      {rating.pillars.map((p) => (
                        <td className="num" key={p.key}>
                          {p.score.toFixed(1)}
                          <small className="per-note">&times;{p.weight}</small>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sec-note">
              The scale: {BANDS.map((b, i) => (
                <span key={b.band}>
                  {i > 0 ? " · " : ""}
                  <b>{b.letter} {b.label}</b> {b.min > 0 ? `${b.min}+` : "under 42"}, {b.blurb}
                </span>
              ))}. Lowest rated right now is{" "}
              {clean(worstRated.row.name) || worstRated.row.symbol} on {worstRated.rating.score}.
              Every token&rsquo;s own page carries its working and the parts it loses points
              for.
            </p>
          </Reveal>
        </section>
      )}

      <section id="depth">
        <h2>Where the money actually is</h2>
        <p className="finding">
          <span className="nowtag">right now</span>
          The whole category holds <b>{usd(totalLiq)}</b> of liquidity across{" "}
          <b>{T.universe.toLocaleString()}</b> tokenized stocks. <b>{top10Share}%</b> of it is in
          the ten below.
        </p>
        <p className="lookfor">
          <span className="k">What to look for</span>
          Liquidity, holders, market share and volume, so you can see where the money actually
          is. A tokenized stock with no liquidity is a listing, not a market, and most of this
          category is listings. The names here are the ones with real money standing behind
          them.
        </p>
              <Reveal label="Show the ranked table" count={`${byLiq.length} with a market`} open>
<p className="scroll-hint">Swipe the table sideways for holders and volume</p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Token</th><th>Issuer</th>
                <th>Liquidity</th><th>Share</th><th>Holders</th><th>24h volume</th><th>Turnover</th>
              </tr>
            </thead>
            <tbody>
              {byLiq.slice(0, 15).map((r, i) => (
                <tr key={r.mint}>
                  <td>
                    <span className="rank">{i + 1}</span>{" "}
                    {r.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="tick-icon" src={r.icon} alt="" width={18} height={18} loading="lazy" />
                    )}
                    <span className="coin">{clean(r.name) || r.symbol}</span>
                  </td>
                  <td><span className="denom">{r.symbol}</span></td>
                  <td className="dex"><Brand name={r.issuer} size={16} label /></td>
                  <td className="num">{usd(r.liquidity)}</td>
                  <td className="num">
                    {totalLiq > 0 ? `${((r.liquidity / totalLiq) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="num">{r.holders.toLocaleString()}</td>
                  <td className="num">{usd(r.volume24h)}</td>
                  <td className="num">{turnCell(r.volume24h, r.liquidity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      </section>

      {/* Volume against depth. This sits straight after the ranked table on
          purpose: the table has just shown a volume column, and this is the
          argument for why that column should not be trusted on its own. */}
      <section id="churn">
        <h2>Volume you can buy, depth you cannot</h2>
        {churnLead && (
          <p className="finding">
            <span className="nowtag">right now</span>
            {churnLead.label} has {usd(churnLead.liquidity)} in its pool and claims{" "}
            {usd(churnLead.volume)} of trading in a day.{" "}
            <b>
              That is the same money going round{" "}
              {Math.round(churnLead.volume / churnLead.liquidity)} times.
            </b>
          </p>
        )}
        <p className="lookfor">
          <span className="k">What to look for</span>
          The liquidity pool is the pot of money you buy from and sell into. Filling it costs
          someone real money. Pushing trades through it costs almost nothing, so anyone can
          make a token look popular by sending the same funds back and forth all day. The
          solid line is what one ordinary day of buying and selling looks like. On the chart
          below, the higher above it a dot sits, the more of its trading is the same money
          going in circles instead of new buyers turning up.
        </p>
      <Reveal label="Show the chart" count={`${churnPoints.length.toLocaleString()} pools`} peek={300}>
        <Churn points={churnPoints} />
      </Reveal>
      </section>

      <section id="issuers">
        <h2>Five issuers, very different shapes</h2>
        {deadest && (
          <p className="finding">
            <span className="nowtag">right now</span>
            {deadest.shown} lists <b>{deadest.listed.toLocaleString()}</b> tokenized stocks.
            All of them together hold <b>{usd(deadest.liquidity)}</b> of liquidity, and{" "}
            <b>{deadest.withPool}</b> have a pool at all.
          </p>
        )}
        <p className="lookfor">
          <span className="k">What to look for</span>
          Liquidity, not the number of tokens. Listing a token costs an issuer nothing, so a
          big catalogue proves nothing on its own. What matters is how much money sits in
          pools behind it, and how much of that catalogue has no pool at all. Used as a quote
          asset is the strictest test: it means other people built markets on top.
        </p>
      <Reveal label="Compare the five issuers" count={`${T.universe.toLocaleString()} listings`} peek={260}>
        <div className="issuers">
          {(["xStocks", "Backpack", "Ondo", "PreStocks", "Tessera"] as const).map((iss) => {
            // Sunrise is the brand the market knows; Backpack Securities is the
            // entity that actually issues, and what the token metadata says.
            const shown = iss === "Backpack" ? "Sunrise" : iss;
            const listed = T.byIssuer[iss] ?? 0;
            const rows = stocks.filter((s) => s.issuer === iss);
            const depth = T.byIssuerDepth[iss];
            const vol = rows.reduce((a, r) => a + r.quotedVolume24h, 0);
            const denoms = rows.filter((r) => r.quotedCount > 0).length;
            return (
              <div className="issuer" key={iss}>
                <p className="issuer-name">
                  <Brand name={iss} size={22} />
                  {shown}
                </p>
                <p className="issuer-sub">
                  {iss === "Backpack" ? "issued by Backpack Securities"
                    : iss === "xStocks" ? "issues the xStocks range"
                    : iss === "PreStocks" ? "pre-IPO equity"
                    : iss === "Tessera" ? "pre-IPO, tessera.pe"
                    : "Ondo Finance"}
                </p>
                <div className="issuer-row"><span>Tokens listed</span><b>{listed.toLocaleString()}</b></div>
                <div className="issuer-row"><span>Have a pool</span><b>{depth?.withPool ?? rows.length}</b></div>
                <div className="issuer-row"><span>Liquidity, all tokens</span><b>{usd(depth?.liquidity ?? 0)}</b></div>
                <div className="issuer-row">
                  <span>The rest hold</span>
                  <b>{usd(depth?.strandedLiquidity ?? 0)}</b>
                </div>
                <div className="issuer-row"><span>Used as a quote asset</span><b>{denoms}</b></div>
                <div className="issuer-row"><span>Quoted volume 24h</span><b>{usd(vol)}</b></div>
              </div>
            );
          })}
        </div>
      </Reveal>
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
        <Reveal label="Show the board" count={`${T.denominators} used as money`}>
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
        </Reveal>
      </section>

      {/* Balances that grow. Placed after the board rather than before it,
          because it is a detail about tokens you have already met. */}
      {accrual.length > 2 && (
        <section id="accrual">
          <h2>What you earned by doing nothing</h2>
          {topAccrual && (
            <p className="finding">
              <span className="nowtag">right now</span>
              <b>{clean(topAccrual.name) || topAccrual.symbol}</b> is earning{" "}
              <b>{((topAccrual.action!.multiplier - 1) * 100).toFixed(2)}%</b> onto every balance,
              which is <b>${((topAccrual.action!.multiplier - 1) * 1000).toFixed(2)}</b> on every
              $1,000 you hold.{" "}
              <b>{accrual.length} tokenized stocks are doing this.</b>
            </p>
          )}
          <p className="lookfor">
            <span className="k">What to look for</span>
            Whether the thing you hold has been growing on its own. These tokens carry a
            multiplier on the mint itself, so a balance of ten is shown as ten times that
            number, and it moves without anything arriving in your wallet. The multiplier is
            read from the token, so it is checkable rather than claimed, and the date is when
            it last moved. xStocks state what is being passed through: dividends on the
            underlying are reinvested into more of the same token, so the balance grows
            instead of cash arriving, and splits run through the same mechanism. Seventeen of
            these pay a dividend and the order here follows the yield. The two that do not,
            DFDV and GameStop, last moved in late 2025 and have not moved since, which looks
            like a one-off rather than a distribution. The numbers themselves are exact.
          </p>
        <Reveal label="Show what is earning" count={`${accrual.length} tokens`}>
          <p className="scroll-hint">Swipe the table sideways for the date and what it is worth</p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Token</th><th>Issuer</th>
                  <th>Balance multiplier</th><th>Earning</th><th>Last changed</th>
                </tr>
              </thead>
              <tbody>
                {accrual.slice(0, 15).map((r, i) => {
                  const m = r.action!.multiplier;
                  return (
                    <tr key={r.mint}>
                      <td>
                        <span className="rank">{i + 1}</span>{" "}
                        {r.icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="tick-icon" src={r.icon} alt="" width={18} height={18} loading="lazy" />
                        )}
                        <span className="coin">{clean(r.name) || r.symbol}</span>
                      </td>
                      <td><span className="denom">{r.symbol}</span></td>
                      <td className="dex"><Brand name={r.issuer} size={16} label /></td>
                      <td className="num">{m.toFixed(6)}</td>
                      <td className="num"><b>{((m - 1) * 100).toFixed(2)}%</b></td>
                      <td className="num">
                        {r.action!.effectiveAt
                          ? new Date(r.action!.effectiveAt).toUTCString().slice(5, 16)
                          : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="standout-note">
            Read from each mint&rsquo;s Token-2022 scaled-amount extension. The date is when the
            multiplier last changed, not when it started.
            {splits.length > 0 && (
              <>
                {" "}
                {splits.length} other token{splits.length === 1 ? " carries" : "s carry"} a far
                larger multiplier, which is a split rather than a distribution and is handled in{" "}
                <a href="#prices">the price comparison</a> instead.
              </>
            )}
          </p>
        </Reveal>
        </section>
      )}

      <section id="coins">
        <h2>Priced in equity</h2>
        <p className="finding">
          <span className="nowtag">right now</span>
          <b>{T.quotedCoins.toLocaleString()}</b> coins are priced in a tokenized stock rather
          than in SOL.{" "}
          <b>
            {T.activeCoins.toLocaleString()} of them were actually traded in the last 24 hours.
          </b>{" "}
          {topCoin && (
            <>The biggest is {topCoin.coin}, settling in {topCoin.underlying}.</>
          )}
        </p>
        <p className="lookfor">
          <span className="k">What to look for</span>
          Whether anyone is on the other side. A pool existing and a pool being used are
          different claims, and launchpads now mint these by the hundred every day, so a
          count of pools flatters the category. A coin is marked <b>seeded</b> here when it
          has fewer than 25 trades in 24 hours: the money is in the pool and nobody is
          trading it. Beyond that, compare liquidity against 24h volume. Volume many times
          larger than the pool is churn rather than depth, and it usually means a handful of
          wallets trading with each other. Anything marked <b>platform</b> is a launchpad or treasury token, so its
          volume reflects that platform rather than demand for a coin. Each row carries the
          coin&rsquo;s contract address so you can copy the right one. It tells you which coin
          this is, nothing more: the issuer check on this site covers the tokenized stocks, not
          the coins quoted against them.
        </p>
      <Reveal label="Show the coins" count={`${T.quotedCoins.toLocaleString()} coins`}>
        <p className="scroll-hint">Swipe the table sideways for liquidity and volume</p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Coin</th><th>Denominated in</th><th>Issuer</th>
                <th>Venue</th><th>Liquidity</th><th>24h volume</th><th>Trades 24h</th><th>24h</th>
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
                    {!c.active && <span className="flag flag-quiet">seeded</span>}
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
                  <td className="dex"><Brand name={c.issuer} size={16} label /></td>
                  <td className="dex">{c.dex}</td>
                  <td className="num">{c.liquidityUsd ? usd(c.liquidityUsd) : "—"}</td>
                  <td className="num">{usd(c.volume24h)}</td>
                  <td className="num">{c.txns24h.toLocaleString()}</td>
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
      </Reveal>
      </section>

      {dupes.length > 0 && (
        <section id="prices">
          <h2>The same company, two prices</h2>
          {widest && (
            <p className="finding">
              <span className="nowtag">right now</span>
              Two issuers price <b>{widest.rows[0].underlying}</b> at{" "}
              <b>${widest.rows[0].price.toFixed(2)}</b> and{" "}
              <b>${widest.rows[widest.rows.length - 1].price.toFixed(2)}</b>.{" "}
              {widest.rows.some((r) => r.pythFeedId)
                ? "There is an oracle price for this one, so one of them is wrong."
                : "No oracle carries this company, so nothing here can check either price."}
            </p>
          )}
          <p className="lookfor">
            <span className="k">What to look for</span>
            A green badge means the issuers agree, because a public share price exists and
            anyone selling it wrong gets arbitraged. A red badge means nobody can tell you
            which price is right, including the issuers. Every price here is per underlying
            share rather than per token, because one token is not always one share: where a
            row says split-adjusted, a corporate action has been divided out and the sticker
            price sits beneath it. That is read from the mint where the issuer encodes it,
            and taken from the issuer where they do not. What is left is a real
            disagreement rather than a unit mismatch.
          </p>
        <Reveal label="Compare the issuers" count={`${dupes.length} companies`}>
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
                    {d.normalised && (
                      <span className="dupe-norm">per share, split-adjusted</span>
                    )}
                  </div>
                  <div className="dupe-row h">
                    <span>Token</span>
                    <span>Issuer</span>
                    <span className="r">Price</span>
                    <span className="r hide-s">Liquidity</span>
                    <span className="r hide-s">24h volume</span>
                    <span className="r">Feed</span>
                    <span className="r">Perp</span>
                  </div>
                  {d.rows.map((r) => (
                    <div className="dupe-row" key={r.mint}>
                      <b>{r.symbol}</b>
                      <span><Brand name={r.issuer} size={16} label /></span>
                      {/* Per share. The sticker price is kept beside it when the
                          two differ, so somebody looking at the token on a DEX can
                          see why this page shows a different number. */}
                      <span className="r">
                        <b>
                          ${(() => { const v = perShare(r); return v < 1 ? v.toFixed(4) : v.toFixed(2); })()}
                        </b>
                        {r.sharesPerToken !== 1 && (
                          <span className="per-note">
                            {r.sharesPerToken}x · ${r.price.toFixed(2)}/token
                          </span>
                        )}
                      </span>
                      <span className="r hide-s">{usd(r.liquidity)}</span>
                      <span className="r hide-s">{usd(r.volume24h)}</span>
                      {/* Three states, not two. A session feed is a real reference
                          price that happens to stop at the closing bell, and calling
                          that "none" is what made SpaceX look unverifiable. */}
                      <span className="r">
                        {r.has247Feed ? "24/7" : r.pythFeedId ? "hours" : "none"}
                      </span>
                      {/* The venue, as its own mark, linked straight to it. Plain
                          links, no referral codes: this column is a recommendation
                          surface, and being paid on it would make "where can you
                          hedge this" a thing we are paid to say rather than a fact. */}
                      <span className={`perp ${r.perpVenues.length ? "" : "no"}`}>
                        {r.perpVenues.length
                          ? r.perpVenues.map((v) => (
                              <a
                                key={v.name}
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open the ${r.underlying} perp on ${v.name}`}
                              >
                                <Brand name={v.name} size={18} />
                              </a>
                            ))
                          : "no"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {anyWide && (
            <div className="callout">
              <b>A gap that survives this is a disagreement, not a denomination.</b>{" "}
              One issuer&apos;s token can represent a different slice of a share than
              another&apos;s. What decides whether you can check is the Feed column, not
              whether the company is public: Pyth carries 24/7 prices for OpenAI and
              Anthropic while both are still private, and carries nothing for several
              listed names. Where it says none, nobody here can tell you which price is
              right. Where it says 24/7 or hours, a reference exists and a gap this wide
              is somebody being wrong rather than nobody being able to tell.
            </div>
          )}
        </Reveal>
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
        <Reveal label="Show which have a feed" count={`${T.with247Feed} with 24/7`} peek={190}>
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
        </Reveal>
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

      {/* The only thing on the site that lets a visitor be reached again. Sixteen
          people used this on launch day and there was no way to find any of them
          afterwards, which is a worse problem than the sixteen. No Solana logo
          here on purpose: there is no official "powered by" lockup to use, the
          gradient fights this palette, and a mark in a footer reads as an
          endorsement nobody has given. The words say it without claiming it. */}
      <footer>
        <span>
          Built on Solana by{" "}
          <a href="https://x.com/takisoul" target="_blank" rel="noopener noreferrer">
            @takisoul
          </a>
          . Open source, MIT, and there is no token.{" "}
          <a href="https://github.com/DimiMili/stonkpile" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </span>
        <span>
          Sources: <a href="https://dev.jup.ag">Jupiter</a> ·{" "}
          <a href="https://docs.dexscreener.com/api/reference">DexScreener</a> ·{" "}
          <a href="https://docs.pyth.network">Pyth</a>. Keyless and public.{" "}
          <a href="/api/index">JSON API</a>
        </span>
        <span>Updated {stamp}</span>

        {/* A securities-adjacent site run by one person needs this in writing,
            and it costs nothing to be exact instead of shouting NFA. It says
            what the numbers are, what they are not, and who is responsible for
            the decision, which is the visitor. */}
        <span className="disclaim">
          Nothing here is financial, investment, legal or tax advice, and nothing
          here is an offer or a recommendation to buy or sell anything. Stonkpile
          reports what public onchain sources say at the moment they are read.
          Prices, liquidity and issuer data move constantly, can be wrong, stale
          or manipulated, and a token passing every check on this page can still
          lose all its value. Tokenized stocks are generally not shares: most are
          a claim on an issuer, and your rights depend entirely on that issuer.
          Verify everything yourself before you send a transaction. Do your own
          research. You are responsible for what you do with this.
        </span>
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
