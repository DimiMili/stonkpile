"use client";

import { useRef, useState } from "react";

/**
 * A single-series line over daily snapshots.
 *
 * Plain SVG, no chart library. The native <title> on every point stays, because
 * it is what a screen reader and a no-JavaScript view get, but a title tooltip
 * is useless on a phone and slow on a desktop, so there is also a scrub: drag
 * or hover anywhere across the chart and the caption shows that day's figure
 * and date. One pointer handler covers mouse, pen and touch; touch-action keeps
 * vertical scrolling working, so a finger moving down the page still scrolls
 * and a finger moving sideways reads the series.
 *
 * One series, so there is no legend: the heading names it. Colour is a single
 * hue that passes the lightness band and the 3:1 contrast floor against both
 * the light and dark surfaces, set as a CSS variable so the theme switches it
 * rather than this component knowing which mode it is in.
 *
 * Renders honestly when there is almost no data. One point draws a dot and says
 * so; zero points render nothing at all. A chart that invents a trend from a
 * single measurement is worse than no chart.
 */
export type FormatName = "usd" | "count" | "plain" | "people";

const FORMAT: Record<FormatName, (v: number) => string> = {
  usd: (v) =>
    v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B`
    : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
    : `$${Math.round(v)}`,
  count: (v) => v.toLocaleString(),
  plain: (v) => String(Math.round(v)),
  people: (v) =>
    v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v),
};

export function Spark({
  points,
  label,
  format,
  height = 92,
}: {
  points: { date: string; value: number }[];
  label: string;
  /* A name, not a function. This became a client component the day it learned
     to be scrubbed, and a function cannot cross that boundary: Next refuses the
     build with "Functions cannot be passed directly to Client Components".
     Naming the format keeps the server page declarative and keeps the
     formatting in one place. */
  format: FormatName;
  height?: number;
}) {
  const fmt = FORMAT[format] ?? FORMAT.plain;
  const svgRef = useRef<SVGSVGElement>(null);
  const [at, setAt] = useState<number | null>(null);

  if (!points.length) return null;

  const W = 560;
  const H = height;
  const PAD = { t: 10, r: 8, b: 16, l: 8 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  // A flat series would divide by zero and, worse, draw a line pinned to one
  // edge. Pad the range so it sits in the middle instead.
  const span = hi - lo || Math.abs(hi) || 1;
  const min = hi === lo ? lo - span / 2 : lo;
  const max = hi === lo ? hi + span / 2 : hi;

  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min)) * ih;

  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area =
    points.length > 1
      ? `${d}L${x(points.length - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)}L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)}Z`
      : "";

  const last = points[points.length - 1];
  const first = points[0];
  /* Read the index off the box rather than off SVG coordinates: the viewBox is
     stretched by preserveAspectRatio="none", so a client x maps to a fraction
     of the width and nothing else. */
  const scrub = (clientX: number) => {
    const el = svgRef.current;
    if (!el || points.length < 2) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setAt(Math.round(f * (points.length - 1)));
  };
  const shown = at === null ? last : points[at];
  const live = at !== null;

  return (
    <figure className="spark">
      <figcaption className="spark-cap">
        <span className="spark-label">{label}</span>
        <span className={live ? "spark-now spark-live" : "spark-now"}>{fmt(shown.value)}</span>
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => scrub(e.clientX)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0) scrub(e.clientX);
        }}
        onPointerLeave={() => setAt(null)}
        onPointerUp={() => setAt(null)}
        onPointerCancel={() => setAt(null)}
        role="img"
        aria-label={`${label}, ${points.length} daily reading${points.length === 1 ? "" : "s"}, latest ${fmt(last.value)}`}
      >
        {points.length > 1 && <path className="spark-area" d={area} />}
        {points.length > 1 && <path className="spark-line" d={d} />}
        {at !== null && points.length > 1 && (
          <g className="spark-mark">
            <line x1={x(at)} y1={PAD.t} x2={x(at)} y2={PAD.t + ih} />
            <circle cx={x(at)} cy={y(points[at].value)} r={5.5} />
          </g>
        )}
        {points.map((p, i) => (
          <circle key={p.date} className="spark-dot" cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5}>
            <title>{`${p.date}: ${fmt(p.value)}`}</title>
          </circle>
        ))}
      </svg>

      <p className="spark-foot">
        {live ? (
          <>{shown.date}</>
        ) : points.length === 1 ? (
          <>First reading, {first.date}. The line starts tomorrow.</>
        ) : (
          <>
            {first.date} to {last.date}, {points.length} daily readings
          </>
        )}
      </p>
    </figure>
  );
}
