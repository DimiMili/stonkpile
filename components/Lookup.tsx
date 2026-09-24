"use client";

import { useMemo, useState } from "react";

export interface LookupItem {
  symbol: string;
  underlying: string;
  name: string;
  issuer: string;
  icon?: string;
  quotedCount: number;
  tradeable: boolean;
}

/** Type a ticker, find out which tokens are real and whether anything trades against them. */
export function Lookup({ items }: { items: LookupItem[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toUpperCase();

  const hits = useMemo(() => {
    if (query.length < 1) return [];
    return items
      .filter(
        (i) =>
          i.underlying.startsWith(query) ||
          i.symbol.toUpperCase().startsWith(query) ||
          i.name.toUpperCase().includes(query),
      )
      .sort((a, b) => {
        const ax = a.underlying === query ? 0 : 1;
        const bx = b.underlying === query ? 0 : 1;
        return ax - bx || b.quotedCount - a.quotedCount;
      })
      .slice(0, 8);
  }, [items, query]);

  return (
    <div className="lookup">
      <label className="lookup-label" htmlFor="ticker">
        Check a ticker
      </label>
      <input
        id="ticker"
        className="lookup-input"
        type="search"
        autoComplete="off"
        placeholder="AAPL, NVDA, GME…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="lookup-hint">
        Which tokenized versions are genuinely issued, which actually trade, and what is
        priced against them.
      </p>

      {query.length > 0 && (
        <div className="lookup-results">
          {hits.length === 0 ? (
            <p className="lookup-empty">
              No verified tokenized stock matches “{q}”. If you have found a token using that
              name on-chain, it is not issued by xStocks, Backpack or Ondo.
            </p>
          ) : (
            hits.map((i) => (
              <a className="hit" key={i.symbol + i.issuer} href={`/s/${i.symbol}`}>
                {i.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="hit-icon" src={i.icon} alt="" width={26} height={26} loading="lazy" />
                ) : (
                  <span className="hit-icon hit-icon-blank" aria-hidden="true" />
                )}
                <span className="hit-sym">{i.symbol}</span>
                <span className="hit-name">{i.name}</span>
                <span className="hit-issuer">{i.issuer}</span>
                <span className="hit-state">
                  {!i.tradeable
                    ? "listed, not traded"
                    : i.quotedCount > 0
                    ? `${i.quotedCount} coins priced in it`
                    : "trades, nothing quoted in it"}
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
