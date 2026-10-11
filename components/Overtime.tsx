"use client";

import { useState, useRef, useCallback } from "react";

/**
 * The category over time, as one chart rather than six.
 *
 * Six stacked sparklines said six small things and no big one. This says the
 * big one: the lines move differently, and the gap between them is the finding.
 *
 * Everything is indexed to 100 at the first reading, which is not a stylistic
 * choice. Liquidity is tens of millions, listings are thousands, tokens with a
 * market are double digits. On one axis four of the five are flat lines on the
 * floor, and two axes would be worse: a dual-axis chart lets you imply any
 * correlation you like by scaling one side. Indexing puts them on the only
 * honest shared scale, which is growth from a common start. The tooltip carries
 * the real figures so nobody has to read percentages back into dollars.
 */

export interface Row {
  date: string;
  liquidity: number;
  universe: number;
  withPool: number;
  holders: number;
  volume: number;
}

type Key = "liquidity" | "universe" | "withPool" | "holders" | "volume";

/* Five hues, checked rather than chosen by eye: every adjacent pair clears the
   colour-blind separation floor and the normal-vision floor, all five sit in
   the lightness band for their surface and carry enough chroma not to read as
   grey. Light and dark are separate steps, not the same hues dimmed. */
const SERIES: { k: Key; label: string; fmt: (v: number) => string }[] = [
  { k: "liquidity", label: "Liquidity", fmt: (v) => `$${(v / 1e6).toFixed(1)}M` },
  { k: "universe", label: "Listings", fmt: (v) => v.toLocaleString() },
  { k: "withPool", label: "With a market", fmt: (v) => v.toLocaleString() },
  { k: "holders", label: "Holders", fmt: (v) => `${(v / 1e6).toFixed(2)}M` },
  { k: "volume", label: "Volume 24h", fmt: (v) => `$${Math.round(v / 1e6)}M` },
];

const W = 1000, H = 320, PL = 4, PR = 4, PT = 8, PB = 52, IH = H - PT - PB;

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });

export function Overtime({ rows }: { rows: Row[] }) {
  const [on, setOn] = useState<Set<Key>>(new Set(SERIES.map((s) => s.k)));
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const live = SERIES.filter((s) => on.has(s.k));
  const last = rows[rows.length - 1];

  const indexed = (k: Key) => {
    const base = rows[0][k] || 1;
    return rows.map((r) => (r[k] / base) * 100);
  };

  const all = live.flatMap((s) => indexed(s.k));
  const lo = all.length ? Math.min(...all, 100) : 95;
  const hi = all.length ? Math.max(...all, 100) : 105;
  const pad = (hi - lo) * 0.16 || 5;
  const y0 = lo - pad, y1 = hi + pad;

  const X = (i: number) => PL + (i / (rows.length - 1)) * (W - PL - PR);
  const Y = (v: number) => PT + IH - ((v - y0) / (y1 - y0)) * IH;

  const toggle = (k: Key) =>
    setOn((prev) => {
      const next = new Set(prev);
      /* Never let the last one off. An empty chart is not a state anyone meant
         to reach, and the axis has nothing to scale to. */
      if (next.has(k)) { if (next.size === 1) return prev; next.delete(k); }
      else next.add(k);
      return next;
    });

  const move = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const step = (W - PL - PR) / (rows.length - 1);
    setHover(Math.max(0, Math.min(rows.length - 1, Math.round((sx - PL) / step))));
  }, [rows.length]);

  const ticks = [0, 1, 2, 3].map((r) => y0 + (r / 3) * (y1 - y0));
  const marks = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];

  return (
    <div className="ot">
      <div className="ot-keys" role="group" aria-label="Show or hide a series">
        {SERIES.map((s) => {
          const shown = on.has(s.k);
          return (
            <button
              key={s.k}
              type="button"
              className="ot-key"
              aria-pressed={shown}
              onClick={() => toggle(s.k)}
            >
              <span className="ot-sw" style={shown ? { background: `var(--ot-${s.k})` } : undefined} />
              {s.label}
              <span className="ot-now">{s.fmt(last[s.k])}</span>
            </button>
          );
        })}
      </div>

      <div className="ot-wrap">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="ot-svg" role="img" aria-label={
          `${live.map((s) => s.label).join(", ")} across all tokenized stocks on Solana, ` +
          `nightly since ${day(rows[0].date)}, each indexed to 100 at the first reading`
        }>
          <g className="ot-grid">
            {ticks.map((v, i) => (
              <line key={i} x1={PL} x2={W - PR} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} />
            ))}
          </g>
          <g className="ot-ax">
            {ticks.map((v, i) => (
              <text key={i} x={PL} y={(Y(v) - 7).toFixed(1)}>{v.toFixed(0)}</text>
            ))}
            {marks.map((i, n) => (
              <text key={i} x={X(i).toFixed(1)} y={PT + IH + 28}
                textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}>
                {day(rows[i].date)}
              </text>
            ))}
          </g>
          {live.map((s) => (
            <path key={s.k} className="ot-ln" stroke={`var(--ot-${s.k})`}
              d={indexed(s.k).map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ")} />
          ))}
          {hover !== null && (
            <>
              <line className="ot-cross" x1={X(hover)} x2={X(hover)} y1={PT} y2={PT + IH} />
              {live.map((s) => (
                <circle key={s.k} r={4.5} fill={`var(--ot-${s.k})`}
                  cx={X(hover)} cy={Y((rows[hover][s.k] / rows[0][s.k]) * 100)} />
              ))}
            </>
          )}
          <rect className="ot-hit" x={0} y={0} width={W} height={PT + IH}
            onPointerMove={move} onPointerLeave={() => setHover(null)} />
        </svg>

        {hover !== null && (
          <div className="ot-tip" style={{ left: `calc(${(X(hover) / W) * 100}% + 16px)` }}>
            <i>{day(rows[hover].date)}</i>
            {live.map((s) => (
              <div className="ot-r" key={s.k}>
                <span><i className="ot-d" style={{ background: `var(--ot-${s.k})` }} />{s.label}</span>
                <b>{s.fmt(rows[hover][s.k])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
