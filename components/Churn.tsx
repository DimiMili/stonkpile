"use client";

import { useState } from "react";
import { Share } from "@/components/Share";

/**
 * Volume against depth, on log axes.
 *
 * A ranking by 24h volume is the easiest number on this site to fake, because
 * volume costs a bot almost nothing and depth costs real money. So the useful
 * question is not how much volume a pool did, it is how much it did relative to
 * what is actually in it. A $15k pool reporting $5.4M of volume claims to have
 * turned its entire contents 323 times in a day, which is not what buying and
 * selling looks like.
 *
 * Plotted as a scatter rather than a bar chart of a ratio, because the ratio on
 * its own hides scale: 40x on a $5k pool is noise, 40x on a $5M pool would be
 * remarkable. Both axes are log, so the honest pools fall along a diagonal and
 * the outliers leave it. The guide lines are the ratio, drawn as geometry rather
 * than printed as a number on every point.
 *
 * Stocks and the coins priced against them are drawn as two series on purpose.
 * The pattern underneath is the finding: the stock pools with the worst ratios
 * are the ones with a churning memecoin quoted against them, and the bots
 * cycling that coin inflate the stock's volume as a side effect.
 */

export interface ChurnPoint {
  label: string;
  sub: string;
  liquidity: number;
  volume: number;
  kind: "stock" | "coin";
}

const W = 720;
const H = 440;
const PAD = { t: 18, r: 18, b: 44, l: 58 };

const money = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
  : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
  : `$${Math.round(v)}`;

export function Churn({ points }: { points: ChurnPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const pts = points.filter((p) => p.liquidity > 0 && p.volume > 0);
  if (pts.length < 5) return null;

  // Fixed decade bounds rather than data extents, so the picture does not
  // reframe itself every five minutes and mean something different each time.
  const xMin = 3, xMax = 7;      // $1k to $10M of liquidity
  const yMin = 3, yMax = 8;      // $1k to $100M of 24h volume
  const lg = (v: number) => Math.log10(v);
  const x = (v: number) =>
    PAD.l + ((Math.min(Math.max(lg(v), xMin), xMax) - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const y = (v: number) =>
    H - PAD.b - ((Math.min(Math.max(lg(v), yMin), yMax) - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  // Ratio guides. On log axes a constant ratio is a straight line, so these are
  // the actual thresholds rather than decoration.
  //
  // The label rides the line rather than sitting at the edge. Edge placement
  // looked obvious and was wrong: these lines leave the plot through the top,
  // not the right, so every label ended up stacked in the same corner naming
  // the wrong line. Each one is parked at its own fraction along the line so
  // the three never meet.
  const SLOPE = -((H - PAD.t - PAD.b) / (yMax - yMin)) / ((W - PAD.l - PAD.r) / (xMax - xMin));
  const ANGLE = (Math.atan(SLOPE) * 180) / Math.PI;
  const guides = [
    { r: 1, at: 0.72, text: "turns once a day" },
    { r: 10, at: 0.46, text: "10x a day" },
    { r: 100, at: 0.09, text: "100x a day" },
  ].map((g) => {
    const x1 = Math.pow(10, xMin), x2 = Math.pow(10, xMax);
    const lx = Math.pow(10, xMin + g.at * (xMax - xMin));
    return {
      ...g,
      x1: x(x1), y1: y(x1 * g.r), x2: x(x2), y2: y(x2 * g.r),
      lxp: x(lx), lyp: y(lx * g.r),
    };
  });

  const ticks = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => Math.pow(10, from + i));

  // Only the worst get a name on the plot. A label on every point is unreadable
  // and a chart that labels nothing makes the reader do the work.
  const ranked = [...pts].sort((a, b) => b.volume / b.liquidity - a.volume / a.liquidity);
  const named = new Set(ranked.slice(0, 5).map((p) => p.label));

  return (
    <div className="viz">
      <div className="viz-head">
        {/* The legend explains the colours, so it goes away with them. */}
        <div className="viz-legend">
          {!table && (
            <>
              <span className="lg-item"><i className="lg-dot s-stock" /> Tokenized stock</span>
              <span className="lg-item"><i className="lg-dot s-coin" /> Coin priced in a stock</span>
            </>
          )}
        </div>
        {/* A two-sided switch rather than a single button. One button that says
            "Show table" makes the reader work out what they are looking at now
            from what the button offers next; a switch shows both states and
            marks the one they are in. */}
        <div className="viz-actions">
        <Share
          image="/api/chart/churn.png"
          title="Volume you can buy, depth you cannot"
          text="Every pool's liquidity against its 24h volume. The ones far above the line are not busier, they are emptier."
          anchor="churn"
        />
        <div className="viz-switch" role="group" aria-label="View as">
          <button type="button" className={!table ? "on" : undefined}
                  aria-pressed={!table} onClick={() => setTable(false)}>
            Chart
          </button>
          <button type="button" className={table ? "on" : undefined}
                  aria-pressed={table} onClick={() => setTable(true)}>
            Table
          </button>
        </div>
        </div>
      </div>

      {table ? (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Pool</th><th>Type</th><th>Liquidity</th><th>24h volume</th><th>Turnover</th></tr>
            </thead>
            <tbody>
              {ranked.slice(0, 20).map((p) => (
                <tr key={p.kind + p.label}>
                  <td><span className="coin">{p.label}</span> <span className="denom">{p.sub}</span></td>
                  <td className="dex">{p.kind === "stock" ? "stock" : "coin"}</td>
                  <td className="num">{money(p.liquidity)}</td>
                  <td className="num">{money(p.volume)}</td>
                  <td className="num">{Math.round(p.volume / p.liquidity)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="viz-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" className="viz-svg"
               aria-label="Liquidity against 24 hour volume for every pool, log scale. Most pools sit near one turn a day; a handful sit a hundred times above it.">
            {/* grid */}
            {ticks(xMin, xMax).map((t) => (
              <line key={`gx${t}`} x1={x(t)} y1={PAD.t} x2={x(t)} y2={H - PAD.b} className="g-line" />
            ))}
            {ticks(yMin, yMax).map((t) => (
              <line key={`gy${t}`} x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} className="g-line" />
            ))}

            {/* ratio guides, labelled at the right edge */}
            {guides.map((g) => (
              <g key={g.r}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
                      className={g.r === 1 ? "r-line r-base" : "r-line"} />
                <text x={g.lxp} y={g.lyp - 6} className="r-tag" textAnchor="middle"
                      transform={`rotate(${ANGLE} ${g.lxp} ${g.lyp - 6})`}>
                  {g.text}
                </text>
              </g>
            ))}

            {/* axes */}
            <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="ax" />
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="ax" />
            {ticks(xMin, xMax).map((t) => (
              <text key={`tx${t}`} x={x(t)} y={H - PAD.b + 16} className="tk" textAnchor="middle">{money(t)}</text>
            ))}
            {ticks(yMin, yMax).map((t) => (
              <text key={`ty${t}`} x={PAD.l - 8} y={y(t) + 3} className="tk" textAnchor="end">{money(t)}</text>
            ))}
            <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} className="axt" textAnchor="middle">
              Liquidity in the pool
            </text>
            <text x={14} y={(PAD.t + H - PAD.b) / 2} className="axt" textAnchor="middle"
                  transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}>
              Volume in 24 hours
            </text>

            {/* marks. Coins first so a stock is never buried under one. */}
            {[...pts].sort((a, b) => (a.kind === "stock" ? 1 : -1)).map((p) => {
              const i = pts.indexOf(p);
              const on = hover === i;
              return (
                <circle key={p.kind + p.label + i} cx={x(p.liquidity)} cy={y(p.volume)}
                        r={on ? 7 : 5}
                        className={`pt ${p.kind === "stock" ? "s-stock" : "s-coin"} ${on ? "on" : ""}`}
                        onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              );
            })}

            {/* direct labels on the worst offenders only */}
            {ranked.slice(0, 5).map((p) => (
              <text key={`l${p.label}`} x={x(p.liquidity) + 9} y={y(p.volume) + 4} className="pl">
                {p.label} {Math.round(p.volume / p.liquidity)}x
              </text>
            ))}
            {named.size === 0 && null}
          </svg>

          {hover !== null && pts[hover] && (
            <div className="viz-tip" style={{ left: `${(x(pts[hover].liquidity) / W) * 100}%`, top: `${(y(pts[hover].volume) / H) * 100}%` }}>
              <b>{pts[hover].label}</b> <span className="denom">{pts[hover].sub}</span>
              <span>{money(pts[hover].liquidity)} in the pool</span>
              <span>{money(pts[hover].volume)} traded in 24h</span>
              <span className="tip-hi">{Math.round(pts[hover].volume / pts[hover].liquidity)}x turnover</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
