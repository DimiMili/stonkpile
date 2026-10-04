import { ImageResponse } from "next/og";
import { buildIndex } from "@/lib/pipeline";
import { fonts } from "@/lib/fonts";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Charts as share cards.
 *
 * The chart on the page is an SVG that only exists inside a browser tab. What
 * travels is a picture, so these are the same charts rebuilt at card size in
 * the card palette, which is the dark one rather than the page's cream: a
 * timeline is dark, and a cream rectangle in it reads as a screenshot of a
 * document rather than as a thing somebody made.
 *
 * Satori does flexbox only, so nothing here is an SVG. The scatter is absolutely
 * positioned dots and the ratio guides are rotated divs, which is less elegant
 * than a path and renders identically.
 */

const W = 1200, H = 630;
const INK = "#0f1218", PAPER = "#e9ebe6", MUTED = "#8b94a0",
      FAINT = "#5b6470", BRASS = "#d9ae51", LINE = "#242a34";
const STOCK = "#4b94e8", COIN = "#eb6834";

const PL = { l: 92, r: 54, t: 158, b: 104 };
const PW = W - PL.l - PL.r;
const PH = H - PL.t - PL.b;

const col = (style: React.CSSProperties = {}): React.CSSProperties =>
  ({ display: "flex", flexDirection: "column", ...style });
const row = (style: React.CSSProperties = {}): React.CSSProperties =>
  ({ display: "flex", flexDirection: "row", alignItems: "center", ...style });
const mono = (size: number, weight: 400 | 600 = 400, color = PAPER): React.CSSProperties =>
  ({ display: "flex", fontFamily: "Mono", fontSize: size, fontWeight: weight, color });
const serif = (size: number, weight: 600 | 800 = 800, color = PAPER): React.CSSProperties =>
  ({ display: "flex", fontFamily: "Bodoni", fontSize: size, fontWeight: weight, color });

const money = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `$${(v / 1e6).toFixed(v / 1e6 >= 10 ? 0 : 1)}M`
  : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
  : `$${Math.round(v)}`;

/**
 * A straight line between two points, as a rotated div.
 *
 * Solid only. A dashed border here made Satori throw while parsing the style,
 * and a lighter colour separates the ratio guides from the baseline just as
 * well at this size.
 */
function Seg(
  { x1, y1, x2, y2, color, width = 1.5 }:
  { x1: number; y1: number; x2: number; y2: number; color: string; width?: number },
) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div
      style={{
        display: "flex", position: "absolute", left: x1, top: y1 - width / 2,
        width: len, height: width, background: color,
        transform: `rotate(${deg}deg)`, transformOrigin: "left center",
      }}
    />
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name: raw } = await params;
  const key = raw.replace(/\.(png|jpg|jpeg)$/i, "").toLowerCase();
  const [idx, fontSet] = await Promise.all([buildIndex(), fonts()]);
  const date = new Date(idx.generatedAt).toUTCString().slice(5, 16).toUpperCase();

  const IMG_HEADERS = {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=604800",
  };

  /* Two of these are not charts at all.
     A section that shares well is not always a picture: the accrual and rating
     sections are a headline and a handful of numbers, and a scatter plot of
     them would be decoration. Same frame, same palette, same footer, so a
     timeline full of these still reads as one site. */
  if (key === "earning" || key === "rating") {
    const rows: { k: string; v: string }[] = [];
    let big = "", caption = "", title = "";

    if (key === "earning") {
      const acc = idx.stocks
        .filter((r) => r.action && r.action.multiplier > 1.00005 && r.action.multiplier < 1.25)
        .sort((a, b) => b.action!.multiplier - a.action!.multiplier);
      const pct = (m: number) => `${((m - 1) * 100).toFixed(2)}%`;
      title = "What you earned by doing nothing";
      big = acc[0] ? pct(acc[0].action!.multiplier) : "0%";
      caption = `${acc.length} doing it   ·   read from the mint, not claimed`;
      // The leader is already the headline number; repeating it as the first
      // column wastes a quarter of the row.
      for (const r of acc.slice(1, 5)) {
        rows.push({ k: r.symbol, v: pct(r.action!.multiplier) });
      }
    } else {
      const b = idx.totals.ratings;
      title = "Every tokenized stock, rated out of 100";
      big = `${b.prime} Prime`;
      caption = `${b.unrated.toLocaleString()} unrated   ·   nothing was ever funded behind them`;
      rows.push(
        { k: "SOUND", v: String(b.sound) },
        { k: "THIN", v: String(b.thin) },
        { k: "FRAGILE", v: String(b.fragile) },
      );
    }

    return new ImageResponse(
      (
        <div style={col({
          width: W, height: H, background: INK, color: PAPER,
          padding: "42px 56px", justifyContent: "space-between",
        })}>
          <div style={{ ...mono(19, 400, BRASS), letterSpacing: 2.4 }}>
            STONKPILE · SOLANA · {date}
          </div>

          <div style={col({ gap: 26 })}>
            <div style={{ ...serif(52, 800, PAPER), lineHeight: 1 }}>{title}</div>
            <div style={{ ...serif(132, 800, BRASS), lineHeight: 1 }}>{big}</div>
            <div style={row({ gap: 56 })}>
              {rows.map((r) => (
                <div key={r.k} style={col({ gap: 6 })}>
                  <div style={{ ...mono(20, 400, FAINT), letterSpacing: 1.8 }}>{r.k.toUpperCase()}</div>
                  <div style={serif(40, 600, PAPER)}>{r.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={row({
            justifyContent: "space-between",
            borderTop: `1px solid ${LINE}`, paddingTop: 18,
          })}>
            <div style={mono(20, 400, MUTED)}>{caption}</div>
            <div style={mono(20, 600, FAINT)}>stonkpile.xyz</div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts: fontSet, headers: IMG_HEADERS },
    );
  }

  if (key !== "churn") {
    return new Response("Unknown chart. Try churn.png, earning.png or rating.png", { status: 404 });
  }

  const pts = [
    ...idx.stocks
      .filter((s) => s.liquidity >= 1000 && s.volume24h >= 1000)
      .map((s) => ({ label: s.symbol, l: s.liquidity, v: s.volume24h, kind: "stock" as const })),
    ...idx.coins
      .filter((c) => c.liquidityUsd >= 1000 && c.volume24h >= 1000)
      .map((c) => ({ label: c.coin, l: c.liquidityUsd, v: c.volume24h, kind: "coin" as const })),
  ];

  const xMin = 3, xMax = 7, yMin = 3, yMax = 8;
  const lg = Math.log10;
  const px = (v: number) =>
    PL.l + ((Math.min(Math.max(lg(v), xMin), xMax) - xMin) / (xMax - xMin)) * PW;
  const py = (v: number) =>
    PL.t + PH - ((Math.min(Math.max(lg(v), yMin), yMax) - yMin) / (yMax - yMin)) * PH;

  const ranked = [...pts].sort((a, b) => b.v / b.l - a.v / a.l);
  const worst = ranked[0];

  /* Label the worst offenders, but only where a label can be read. Taking the
     top four by ratio put two of them on the same pixel and printed one string
     over the other, so each candidate has to clear the ones already placed. */
  const named: typeof ranked = [];
  for (const p of ranked) {
    if (named.length >= 4) break;
    const x = px(p.l), y = py(p.v);
    if (named.every((q) => Math.abs(px(q.l) - x) > 150 || Math.abs(py(q.v) - y) > 34)) {
      named.push(p);
    }
  }

  const decades = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => Math.pow(10, from + i));

  /* A ratio is a straight line on log axes. Clamp each one to the plot box so
     the three leave through whichever edge they reach first. */
  const guide = (r: number) => {
    const x1 = Math.pow(10, xMin);
    const topLiq = Math.pow(10, yMax) / r;
    const x2 = Math.min(topLiq, Math.pow(10, xMax));
    return { x1: px(x1), y1: py(x1 * r), x2: px(x2), y2: py(x2 * r) };
  };

  return new ImageResponse(
    (
      <div style={col({
        width: W, height: H, background: INK, color: PAPER,
        padding: "42px 56px", justifyContent: "space-between",
      })}>
        <div style={row({ justifyContent: "space-between", letterSpacing: 2.4 })}>
          <div style={mono(19, 400, BRASS)}>STONKPILE · SOLANA · {date}</div>
          <div style={row({ gap: 26 })}>
            <div style={row({ gap: 9 })}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: STOCK }} />
              <div style={mono(17, 400, MUTED)}>STOCK</div>
            </div>
            <div style={row({ gap: 9 })}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: COIN }} />
              <div style={mono(17, 400, MUTED)}>COIN</div>
            </div>
          </div>
        </div>

        <div style={col({ position: "absolute", left: 56, top: 92 })}>
          <div style={{ ...serif(46, 800, PAPER), lineHeight: 1 }}>
            Volume you can buy, depth you cannot
          </div>
        </div>

        {/* plot */}
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: H }}>
          {decades(xMin, xMax).map((t) => (
            <Seg key={`gx${t}`} x1={px(t)} y1={PL.t} x2={px(t)} y2={PL.t + PH} color={LINE} width={1} />
          ))}
          {decades(yMin, yMax).map((t) => (
            <Seg key={`gy${t}`} x1={PL.l} y1={py(t)} x2={PL.l + PW} y2={py(t)} color={LINE} width={1} />
          ))}

          {[1, 10, 100].map((r) => {
            const g = guide(r);
            return (
              <Seg key={`r${r}`} {...g} color={r === 1 ? "#6b7480" : "#39414d"} width={2} />
            );
          })}

          {pts.map((p, i) => (
            <div key={i} style={{
              display: "flex", position: "absolute",
              left: px(p.l) - 5, top: py(p.v) - 5,
              width: 10, height: 10, borderRadius: 5,
              background: p.kind === "stock" ? STOCK : COIN,
            }} />
          ))}

          {named.map((p, i) => (
            <div key={`n${i}`} style={{
              ...mono(19, 600, PAPER), position: "absolute",
              left: px(p.l) + 12, top: py(p.v) - 11,
            }}>
              {p.label} {Math.round(p.v / p.l)}x
            </div>
          ))}

          {decades(xMin, xMax).map((t) => (
            <div key={`tx${t}`} style={{
              ...mono(17, 400, FAINT), position: "absolute",
              left: px(t) - 24, top: PL.t + PH + 12, width: 48, justifyContent: "center",
            }}>{money(t)}</div>
          ))}
          {decades(yMin, yMax).map((t) => (
            <div key={`ty${t}`} style={{
              ...mono(17, 400, FAINT), position: "absolute",
              left: 0, top: py(t) - 10, width: PL.l - 12, justifyContent: "flex-end",
            }}>{money(t)}</div>
          ))}
        </div>

        <div style={row({
          justifyContent: "space-between",
          borderTop: `1px solid ${LINE}`, paddingTop: 18,
        })}>
          <div style={mono(20, 400, MUTED)}>
            {worst
              ? `${worst.label} turns its pool ${Math.round(worst.v / worst.l)}x a day   ·   diagonals are 1x, 10x, 100x`
              : `diagonals are 1x, 10x, 100x a day`}
          </div>
          <div style={mono(20, 600, FAINT)}>stonkpile.xyz</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fontSet, headers: IMG_HEADERS },
  );
}
