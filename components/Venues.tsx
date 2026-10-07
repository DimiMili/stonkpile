import type { Pool, PerpVenue, Issuer } from "@/lib/pipeline";
import { issuerAction, poolAction, perpAction, anyPaid, DISCLOSURE } from "@/lib/referrals";
import { Brand } from "@/components/Brand";

/**
 * Where to actually buy this, and how deep each place is.
 *
 * Until now the site said a token had four pools and made you go and find them.
 * The pool URLs were being thrown away in the scan, which is the kind of gap
 * that makes a research site feel like homework.
 *
 * This section sits AFTER the five checks on purpose. The checks answer whether
 * this is the real token; a buy button above them would be inviting somebody to
 * act before the page has told them it is safe to.
 *
 * One link here pays us. It is marked on the link itself and stated in words
 * underneath, and it is the only one. See lib/referrals.ts for why the money
 * cannot reach the rating.
 */

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

export function Venues({
  symbol, issuer, pools, perpVenues, liquidity,
}: {
  symbol: string;
  issuer: Issuer;
  pools: Pool[];
  perpVenues: PerpVenue[];
  liquidity: number;
}) {
  const buy = issuerAction(issuer);
  const poolLinks = pools.map((p) => ({ ...poolAction(p.dex, p.url), depth: p.liquidityUsd }));
  const perpLinks = perpVenues.map((p) => perpAction(p.name, p.url));

  if (!buy && poolLinks.length === 0 && perpLinks.length === 0) return null;

  const paid = anyPaid([buy, ...poolLinks, ...perpLinks]);

  return (
    <section>
      <h2>Where to buy {symbol}</h2>
      <p className="sec-note">
        Every market we found behind {symbol}, deepest first, each one a link straight to that
        pool rather than to a front page. The depth figure is what is sitting in the pool now,
        which is roughly what you could sell into before the price moves against you.
      </p>

      <div className="venue-list">
        {buy && (
          <a className="venue venue-lead" href={buy.url} target="_blank" rel="noopener noreferrer">
            <Brand name={issuer} size={22} />
            <span className="venue-name">{buy.label}</span>
            <span className="venue-meta">
              {issuer} issues it and runs the exchange
              {buy.referral && <span className="venue-tag">referral</span>}
            </span>
          </a>
        )}

        {poolLinks.map((p) => (
          <a className="venue" key={p.label} href={p.url} target="_blank" rel="noopener noreferrer">
            <span className="venue-name">{p.label}</span>
            <span className="venue-meta">{usd(p.depth)} deep</span>
          </a>
        ))}

        {perpLinks.map((p) => (
          <a className="venue" key={p.label} href={p.url} target="_blank" rel="noopener noreferrer">
            <span className="venue-name">{p.label}</span>
            <span className="venue-meta">
              perp, so you can short it
              {p.referral && <span className="venue-tag">referral</span>}
            </span>
          </a>
        ))}
      </div>

      {pools.length > 1 && (
        <p className="sec-note">
          {usd(liquidity)} across {pools.length} pools, and it does not move between them: a sale
          bigger than the deepest one costs you more than the top line suggests.
        </p>
      )}

      {paid && <p className="sec-note disclosure">{DISCLOSURE}</p>}
    </section>
  );
}
