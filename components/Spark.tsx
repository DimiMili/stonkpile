/**
 * A single-series line over daily snapshots.
 *
 * Server rendered as plain SVG: no chart library, no client JavaScript, and
 * nothing to hydrate. Per-point inspection comes from native <title> elements
 * rather than a hover layer, which costs nothing and still works with a
 * keyboard and a screen reader.
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
export function Spark({
  points,
  label,
  format,
  height = 92,
}: {
  points: { date: string; value: number }[];
  label: string;
  format: (v: number) => string;
  height?: number;
}) {
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

  return (
    <figure className="spark">
      <figcaption className="spark-cap">
        <span className="spark-label">{label}</span>
        <span className="spark-now">{format(last.value)}</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}, ${points.length} daily reading${points.length === 1 ? "" : "s"}, latest ${format(last.value)}`}
      >
        {points.length > 1 && <path className="spark-area" d={area} />}
        {points.length > 1 && <path className="spark-line" d={d} />}
        {points.map((p, i) => (
          <circle key={p.date} className="spark-dot" cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5}>
            <title>{`${p.date}: ${format(p.value)}`}</title>
          </circle>
        ))}
      </svg>

      <p className="spark-foot">
        {points.length === 1 ? (
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
