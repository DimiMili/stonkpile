"use client";

import { useMemo, useState } from "react";
import { Brand } from "@/components/Brand";
import { RatingChip } from "@/components/Rating";
import type { Claim } from "@/lib/redemption";

/**
 * The rated board: filter by issuer, sort by any column.
 *
 * Two pieces of feedback produced this. Somebody read the board and said it was
 * too much at once, and somebody else came with an exact question, "does
 * Backpack issue NVDA", and could not see where to look. A wall of rows answers
 * neither. One tap on an issuer answers the second, and a sortable column lets
 * the first person arrive at whatever they actually came for.
 *
 * The chip row is a finding before anything is tapped. Backpack has 71 rated and
 * xStocks 32, which says more about how those two operate than a paragraph
 * would. Issuers with nothing rated are left out of it on purpose: a chip
 * reading zero is a puzzle here, and that fact has room to be explained in the
 * issuer comparison further down.
 *
 * Everything is derived in the browser from one array. No fetching, no routes,
 * no loading state, and it still renders on the server for anybody without
 * JavaScript, who gets the default view rather than nothing.
 */

export interface BoardRow {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  issuer: string;
  score: number;
  band: string;
  letter: string;
  bandLabel: string;
  claim: Claim;
  liquidity: number;
}

type Key = "rank" | "name" | "score" | "symbol" | "issuer" | "claim";

/** Which way a column wants to be read the first time you tap it. Scores and
 *  money want the big end first; names want A to Z. Getting this wrong means
 *  every first tap shows the least interesting end of the data. */
const FIRST: Record<Key, 1 | -1> = {
  rank: 1, name: 1, score: -1, symbol: 1, issuer: 1, claim: 1,
};

const COLS: { key: Key; label: string }[] = [
  { key: "name", label: "Company" },
  { key: "symbol", label: "Token" },
  { key: "score", label: "Rating" },
  { key: "issuer", label: "Issuer" },
  { key: "claim", label: "Redeem for" },
];

const SHOWN = 8;

export function RatedBoard({ rows }: { rows: BoardRow[] }) {
  const [issuer, setIssuer] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "score", dir: -1 });

  /* Counts come off the whole set, never off the filtered one, so the numbers on
     the chips do not move around as you tap them. */
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.issuer, (m.get(r.issuer) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const view = useMemo(() => {
    const picked = issuer ? rows.filter((r) => r.issuer === issuer) : rows;
    const { key, dir } = sort;
    const val = (r: BoardRow) =>
      key === "score" ? r.score
      : key === "name" ? (r.name || r.symbol).toLowerCase()
      : key === "symbol" ? r.symbol.toLowerCase()
      : key === "issuer" ? r.issuer.toLowerCase()
      : r.claim;
    return [...picked].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === y) return b.score - a.score; // ties fall back to the score
      return (x > y ? 1 : -1) * dir;
    });
  }, [rows, issuer, sort]);

  const tap = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: FIRST[key] }));

  return (
    <>
      <div className="iss-row" role="group" aria-label="Filter by issuer">
        <button
          type="button"
          className={issuer === null ? "on" : undefined}
          aria-pressed={issuer === null}
          onClick={() => setIssuer(null)}
        >
          <span>All</span>
          <span className="n">{rows.length}</span>
        </button>
        {counts.map(([name, n]) => (
          <button
            key={name}
            type="button"
            className={issuer === name ? "on" : undefined}
            aria-pressed={issuer === name}
            onClick={() => setIssuer(issuer === name ? null : name)}
          >
            <Brand name={name} size={17} />
            <span>{name}</span>
            <span className="n">{n}</span>
          </button>
        ))}
      </div>

      <div className="scroll">
        <table className="sortable">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} aria-sort={
                  sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"
                }>
                  <button type="button" onClick={() => tap(c.key)}>
                    {c.label}
                    <span className="sort-mark" aria-hidden="true">
                      {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, SHOWN).map((r, i) => (
              <tr key={r.mint}>
                {/* The company name goes to the same page as the ticker. People
                    aim at the name, which is the widest thing in the row and was
                    the only part of it that did nothing. */}
                <td>
                  <span className="rank">{i + 1}</span>{" "}
                  {r.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="tick-icon" src={r.icon} alt="" width={18} height={18} loading="lazy" />
                  )}
                  <a className="coin coin-link" href={`/s/${r.symbol}`}>{r.name || r.symbol}</a>
                </td>
                <td><a className="denom" href={`/s/${r.symbol}`}>{r.symbol}</a></td>
                <td>
                  <RatingChip rating={{ score: r.score, band: r.band as never, pillars: [], flags: [] }} />
                </td>
                <td className="dex"><Brand name={r.issuer} size={16} label /></td>
                <td className="dex">
                  <span className={`rd-tag rd-${r.claim}`}>
                    {r.claim === "unstated" ? "not stated" : r.claim}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.length > SHOWN && (
        <p className="board-more">
          Showing {SHOWN} of {view.length}
          {issuer ? ` from ${issuer}` : ""}.{" "}
          <a href="/rating">The whole table</a>.
        </p>
      )}
      {view.length === 0 && (
        <p className="board-more">Nothing from {issuer} has a market yet.</p>
      )}
    </>
  );
}
