import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { Brand } from "@/components/Brand";
import { Share } from "@/components/Share";
import { RatingChip } from "@/components/Rating";
import { Churn } from "@/components/Churn";
import { accrualRows, churnPoints, ratedRows } from "@/lib/sections";
import { BANDS } from "@/lib/rating";
import { REDEMPTION } from "@/lib/redemption";

/**
 * A page per shareable section.
 *
 * A link to /#accrual scrolls a human to the right place and tells a crawler
 * nothing: the part after the hash never reaches the server, so every anchor
 * link posted anywhere showed the home page's card. Three sections are worth
 * sharing on their own, so three sections get a real URL, their own title and
 * description, and their own card.
 *
 * These are not copies of the home page. Each one is the same finding in a page
 * you can land on cold, with the table and a way into the rest of the site, and
 * every number comes from the same derivation the home page uses.
 */

export const revalidate = 300;
export const dynamicParams = false;

const SECTIONS = ["earning", "rating", "volume"] as const;
type Section = (typeof SECTIONS)[number];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;
const clean = (s: string) =>
  s.replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "").trim();

const isSection = (s: string): s is Section => (SECTIONS as readonly string[]).includes(s);

export async function generateMetadata(
  { params }: { params: Promise<{ section: string }> },
): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return { title: "Stonkpile" };

  const idx = await buildIndex();
  const accrual = accrualRows(idx.stocks);
  const rated = ratedRows(idx.stocks);
  const top = accrual[0];
  const best = rated[0];
  const churn = churnPoints(idx);
  const worst = [...churn].sort((a, b) => b.volume / b.liquidity - a.volume / a.liquidity)[0];

  const copy: Record<Section, { title: string; description: string }> = {
    earning: {
      title: `${accrual.length} tokenized stocks grow while you hold them`,
      description: top
        ? `${clean(top.name) || top.symbol} is earning ${((top.action!.multiplier - 1) * 100).toFixed(2)}% onto every balance. The multiplier sits on the mint, so it is checkable rather than claimed.`
        : "Balances that grow on their own, read from the mint.",
    },
    rating: {
      title: `${idx.totals.ratings.prime} tokenized stocks rate Prime, ${idx.totals.ratings.unrated.toLocaleString()} are unrated`,
      description: best
        ? `Every tokenized stock with a market, scored out of 100 on depth, use, ways out and whether it can be priced. Best right now is ${clean(best.row.name) || best.row.symbol} on ${best.rating.score}.`
        : "Every tokenized stock with a market, scored out of 100.",
    },
    volume: {
      title: worst
        ? `${worst.label} turns over its own pool ${Math.round(worst.volume / worst.liquidity)} times a day`
        : "Volume you can buy, depth you cannot",
      description:
        "Liquidity against 24-hour volume for every pool on Solana priced in a tokenized stock. The higher above the line, the more of the trading is the same money going round.",
    },
  };

  const v = `${Math.floor(Date.parse(idx.generatedAt) / 86_400_000)}r1`;
  const card = section === "volume"
    ? `${siteUrl}/api/chart/churn.png?v=${v}`
    : `${siteUrl}/api/chart/${section}.png?v=${v}`;
  const { title, description } = copy[section];

  return {
    title,
    description,
    openGraph: {
      title, description, type: "website",
      url: `${siteUrl}/${section}`,
      images: [{ url: card, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

export default async function SectionPage(
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  if (!isSection(section)) notFound();

  const idx = await buildIndex();
  const accrual = accrualRows(idx.stocks);
  const rated = ratedRows(idx.stocks);
  const churn = churnPoints(idx);
  const top = accrual[0];
  const best = rated[0];
  const worst = [...churn].sort((a, b) => b.volume / b.liquidity - a.volume / a.liquidity)[0];

  const heading: Record<Section, string> = {
    earning: "What you earned by doing nothing",
    rating: "What the rating says",
    volume: "Volume you can buy, depth you cannot",
  };

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          <a className="brand" href="/">Stonkpile</a>
          <span className="dot">/</span>
          <span>{new Date(idx.generatedAt).toUTCString().slice(5, 16)}</span>
        </p>
        <h1>{heading[section]}</h1>

        {section === "earning" && top && (
          <p className="standfirst">
            {clean(top.name) || top.symbol} is earning{" "}
            {((top.action!.multiplier - 1) * 100).toFixed(2)}% onto every balance, which is $
            {((top.action!.multiplier - 1) * 1000).toFixed(2)} on every $1,000 you hold.{" "}
            {accrual.length} tokenized stocks are doing this. The multiplier sits on the mint,
            so it is checkable rather than claimed.
          </p>
        )}
        {section === "rating" && best && (
          <p className="standfirst">
            {idx.totals.ratings.prime} of the {rated.length} markets here rate Prime and{" "}
            {idx.totals.ratings.fragile} rate Fragile. The other{" "}
            {idx.totals.ratings.unrated.toLocaleString()} listings are unrated, because nothing
            was ever funded behind them.
          </p>
        )}
        {section === "volume" && worst && (
          <p className="standfirst">
            {worst.label} holds {usd(worst.liquidity)} and claims {usd(worst.volume)} of trading
            in a day, which is the same money going round{" "}
            {Math.round(worst.volume / worst.liquidity)} times. Every pool priced in a tokenized
            stock, liquidity against volume.
          </p>
        )}
      </header>

      {section === "earning" && (
        <section>
          <p className="sec-note">
            These tokens carry a multiplier on the mint itself, so a balance of ten is shown as
            ten times that number, and it moves without anything arriving in your wallet.
            xStocks state what is being passed through: dividends on the underlying are
            reinvested into more of the same token, so the balance grows instead of cash
            arriving, and splits run through the same mechanism. Seventeen of these pay a
            dividend and the order here follows the yield. The two that do not, DFDV and
            GameStop, last moved in late 2025 and have not moved since, which looks like a
            one-off rather than a distribution. The numbers themselves are exact.
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Token</th><th>Issuer</th>
                  <th>Balance multiplier</th><th>Earning</th><th>Last changed</th>
                </tr>
              </thead>
              <tbody>
                {accrual.map((r, i) => {
                  const m = r.action!.multiplier;
                  return (
                    <tr key={r.mint}>
                      <td>
                        <span className="rank">{i + 1}</span>{" "}
                        <span className="coin">{clean(r.name) || r.symbol}</span>
                      </td>
                      <td><a className="denom" href={`/s/${r.symbol}`}>{r.symbol}</a></td>
                      <td className="dex"><Brand name={r.issuer} size={16} label /></td>
                      <td className="num">{m.toFixed(6)}</td>
                      <td className="num"><b>{((m - 1) * 100).toFixed(2)}%</b></td>
                      <td className="num">
                        {r.action!.effectiveAt
                          ? new Date(r.action!.effectiveAt).toUTCString().slice(5, 16)
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

      {section === "rating" && (
        <section>
          <p className="sec-note">
            Four parts, each out of 10, each carrying its own weight. Ten across all four is
            100. It rates the market around a token, never the company behind it.
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
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Token</th><th>Issuer</th><th>Rating</th><th>Redeem for</th>
                  <th>Liquidity</th><th>Real volume</th><th>Exits</th><th>Pricing</th>
                </tr>
              </thead>
              <tbody>
                {rated.map(({ row, rating }, i) => (
                  <tr key={row.mint}>
                    <td>
                      <span className="rank">{i + 1}</span>{" "}
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
            {BANDS.map((b, i) => (
              <span key={b.band}>
                {i > 0 ? " · " : ""}
                <b>{b.letter} {b.label}</b> {b.min > 0 ? `${b.min}+` : "under 42"}, {b.blurb}
              </span>
            ))}. The whole recipe is in the repo.
          </p>
        </section>
      )}

      {section === "volume" && (
        <section>
          <p className="sec-note">
            The liquidity pool is the pot of money you buy from and sell into. Filling it costs
            someone real money; pushing trades through it costs almost nothing, so anyone can
            make a token look popular by sending the same funds back and forth all day. The
            solid line is one ordinary day of buying and selling. The higher above it a dot
            sits, the more of its trading is the same money going in circles.
          </p>
          <Churn points={churn} />
        </section>
      )}

      <section>
        <Share
          url={`${siteUrl}/${section}`}
          card={`${siteUrl}/api/chart/${section === "volume" ? "churn" : section}.png`}
          text={heading[section]}
        />
      </section>

      <footer>
        <span><a href="/">Every tokenized stock on Solana</a></span>
      </footer>
    </div>
  );
}
