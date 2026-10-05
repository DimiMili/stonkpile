import { bandLabel, bandLetter, isRated, type RatingResult } from "@/lib/rating";
import { CLAIM_LABEL, REDEMPTION } from "@/lib/redemption";
import type { Issuer } from "@/lib/pipeline";

/**
 * The rating, shown with its working.
 *
 * A score on its own is a thing you either believe or ignore. The whole
 * argument for this site rating anything is that every point is traceable to a
 * number already on the page, so the breakdown is not an optional detail view:
 * it ships next to the score, always, and the flags say the uncomfortable parts
 * out loud rather than letting a good headline number bury them.
 */

export function RatingChip({ rating }: { rating?: RatingResult }) {
  if (!isRated(rating)) {
    return <span className="rt-chip rt-none">Unrated</span>;
  }
  return (
    <span className={`rt-chip rt-${rating.band}`} title={bandLabel(rating.band)}>
      <b className="rt-letter">{bandLetter(rating.band)}</b>
      <span className="num">{rating.score}</span>
    </span>
  );
}

/**
 * The front-door claim, beside the score and never in it.
 *
 * A rating here says how good the market around a token is. This says what you
 * hold when you leave through the issuer instead of through a pool, which is
 * the oldest question in the business and the one a pool depth cannot answer.
 */
export function Redeems({ issuer }: { issuer: Issuer }) {
  const r = REDEMPTION[issuer];
  if (!r) return null;
  return (
    <div className="rd">
      <div className="rd-top">
        <span className={`rd-tag rd-${r.claim}`}>{CLAIM_LABEL[r.claim]}</span>
      </div>
      <p>{r.what}</p>
      <p className="rd-who">{r.who}</p>
      <p className="rd-src">
        Read {r.asOf} from {r.source}.{" "}
        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
        {r.alsoUrl && (
          <>
            {" and "}
            <a href={r.alsoUrl} target="_blank" rel="noopener noreferrer">a second</a>
          </>
        )}
        . Terms change, so check them before you act on this.
      </p>
    </div>
  );
}

export function RatingCard({
  symbol,
  rating,
  issuer,
}: {
  symbol: string;
  rating?: RatingResult;
  issuer?: Issuer;
}) {
  if (!isRated(rating)) {
    return (
      <section className="rt-card">
        <h2>{symbol} is not rated</h2>
        <p className="sec-note">
          {rating?.reason ??
            "Nothing here to measure yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="rt-card">
      <h2>
        {symbol} rates <RatingChip rating={rating} /> {bandLabel(rating.band)}
      </h2>
      <p className="sec-note">
        Each part is scored out of 10 and carries its own weight, so ten across all four is
        exactly 100. Nothing here is about the company, or about whether the price is fair.
      </p>
      <ul className={`rt-pillars rt-b-${rating.band}`}>
        {rating.pillars.map((p) => (
          <li key={p.key}>
            <span className="rt-label">{p.label}</span>
            <span className="rt-track">
              <span
                className="rt-fill"
                style={{ width: `${Math.max(1, p.score * 10)}%` }}
              />
            </span>
            <span className="rt-pts num">
              {p.score.toFixed(1)}
              <small>/10 &times;{p.weight}</small>
            </span>
            <span className="rt-detail">{p.detail}</span>
          </li>
        ))}
      </ul>
      {issuer && <Redeems issuer={issuer} />}
      {rating.flags.length > 0 && (
        <ul className="rt-flags">
          {rating.flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
