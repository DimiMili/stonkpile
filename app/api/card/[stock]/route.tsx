import { ImageResponse } from "next/og";
import { buildIndex, type StockRow, type Index } from "@/lib/pipeline";
import { fonts } from "@/lib/fonts";
import { BANDS, bandLabel, bandLetter, isRated, type Band, type Rating } from "@/lib/rating";
import { CLAIM_LABEL, REDEMPTION } from "@/lib/redemption";

export const runtime = "nodejs";
export const revalidate = 300;

const W = 1200, H = 630;
const INK = "#0f1218", PAPER = "#e9ebe6", MUTED = "#8b94a0",
      FAINT = "#5b6470", BRASS = "#d9ae51", LINE = "#242a34",
      TRACK = "#20262f", DOWN = "#ef6d62", UP = "#41cb8b";

/* The same four colours the chip uses on the site. A card that grades a token
   green while the page grades it amber is a card nobody trusts twice. */
const BAND_COLOR: Record<Band, string> = {
  prime: UP, sound: BRASS, thin: MUTED, fragile: DOWN,
};

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(v / 1e6 >= 10 ? 1 : 2)}M`
  : v >= 1e3 ? `$${Math.round(v / 1e3)}k`
  : `$${Math.round(v)}`;

const clean = (s: string) =>
  s.replace(/\s*(xStock|-\s*Backpack Securities|\(Ondo Tokenized\))\s*/gi, "").trim();

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* Satori only does flexbox, and every box needs display:flex plus an explicit
   direction. These helpers make that impossible to forget. */
const col = (style: React.CSSProperties = {}): React.CSSProperties =>
  ({ display: "flex", flexDirection: "column", ...style });
const row = (style: React.CSSProperties = {}): React.CSSProperties =>
  ({ display: "flex", flexDirection: "row", alignItems: "center", ...style });
const mono = (size: number, weight: 400 | 600 = 400, color = PAPER): React.CSSProperties =>
  ({ display: "flex", fontFamily: "Mono", fontSize: size, fontWeight: weight, color });
const serif = (size: number, weight: 600 | 800 = 800, color = PAPER): React.CSSProperties =>
  ({ display: "flex", fontFamily: "Bodoni", fontSize: size, fontWeight: weight, color });

function Bar({ pct }: { pct: number }) {
  return (
    <div style={row({ flex: 1, height: 10, background: TRACK, marginRight: 24 })}>
      <div style={{ display: "flex", width: `${Math.max(pct, 1)}%`, height: 10, background: BRASS }} />
    </div>
  );
}

/* One part of the rating: what it measures, how full it is, and the two numbers
   that let somebody add the total up themselves. The bar is wide on purpose.
   A timeline renders this at about a third of its size, where the four bar
   lengths are the only thing still legible, so they carry the verdict and the
   digits confirm it for anyone who opens the image. */
function PillarRow({
  label, score, weight, color,
}: { label: string; score: number; weight: number; color: string }) {
  return (
    <div style={row({ height: 62 })}>
      <div style={{ ...mono(25, 400, PAPER), width: 268 }}>{label}</div>
      <div style={row({ flex: 1, height: 18, background: TRACK, marginRight: 22 })}>
        <div style={{
          display: "flex", width: `${Math.max(score * 10, 1.5)}%`,
          height: 18, background: color,
        }} />
      </div>
      <div style={{ ...mono(27, 600, PAPER), width: 62, justifyContent: "flex-end" }}>
        {score.toFixed(1)}
      </div>
      <div style={{ ...mono(21, 400, FAINT), width: 72, justifyContent: "flex-end" }}>
        &times;{weight}
      </div>
    </div>
  );
}

/* The verdict, as big as it can be drawn. The letter is the thing that survives
   a thumbnail; the score is for the person who stops. */
function Verdict({ rating }: { rating: Rating }) {
  const c = BAND_COLOR[rating.band];
  return (
    <div style={row({ alignItems: "flex-start" })}>
      <div style={col({
        width: 168, height: 168, border: `4px solid ${c}`,
        alignItems: "center", justifyContent: "center", marginRight: 30,
      })}>
        <div style={{ ...serif(132, 800, c), lineHeight: 1 }}>{bandLetter(rating.band)}</div>
      </div>
      <div style={col({ paddingTop: 10 })}>
        <div style={row({ alignItems: "flex-end" })}>
          <div style={{ ...serif(96, 800, PAPER), lineHeight: 1 }}>{rating.score}</div>
          <div style={{ ...mono(28, 400, MUTED), marginLeft: 12, paddingBottom: 10 }}>/ 100</div>
        </div>
        <div style={{ ...mono(30, 600, c), letterSpacing: 2, marginTop: 14 }}>
          {bandLabel(rating.band).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function Chrome({ date, open }: { date: string; open?: boolean }) {
  return (
    <div style={row({ justifyContent: "space-between", letterSpacing: 2.4 })}>
      <div style={mono(19, 400, BRASS)}>STONKPILE · SOLANA · {date}</div>
      <div style={mono(19, 400, open ? UP : DOWN)}>NYSE {open ? "OPEN" : "CLOSED"}</div>
    </div>
  );
}

function Footer({ bits, warn }: { bits: string[]; warn?: string }) {
  return (
    <div style={row({
      justifyContent: "space-between",
      borderTop: `1px solid ${LINE}`, paddingTop: 18,
    })}>
      <div style={mono(20, 400, MUTED)}>{bits.join("   ·   ")}</div>
      <div style={mono(20, 600, warn ? DOWN : FAINT)}>{warn ?? "stonkpile"}</div>
    </div>
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ stock: string }> },
) {
  const { stock: raw } = await params;
  const key = raw.replace(/\.(png|jpg|jpeg)$/i, "").toUpperCase();

  /* Rendering an image is the most expensive thing this app does: it loads the
     fonts, runs Satori and rasterises, and every distinct path is a new CDN
     cache entry. Rendering one for a ticker that does not exist means anyone
     can mint unlimited expensive, uncacheable-in-practice work by walking
     /api/card/AAAA.png, /api/card/AAAB.png and so on. So an unknown key costs a
     string comparison and nothing else. */
  if (key.length > 24 || !/^[A-Z0-9.\-]+$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const [idx, fontSet] = await Promise.all([buildIndex(), fonts()]);

  const date = new Date(idx.generatedAt).toUTCString().slice(5, 16).toUpperCase();
  const open = idx.marketSession?.isOpen;

  /* A cold render runs the whole pipeline, which is slower than a social
     crawler will wait. stale-while-revalidate means that once a card has been
     rendered even once, the CDN answers instantly from then on and refreshes
     in the background. Warm every card by loading /cards after a deploy. */
  const IMG_HEADERS = {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=604800",
  };

  const shell = (body: React.ReactNode, foot: React.ReactNode) =>
    new ImageResponse(
      (
        <div style={col({
          width: W, height: H, background: INK, color: PAPER,
          padding: "42px 56px", justifyContent: "space-between",
        })}>
          <Chrome date={date} open={open} />
          {body}
          {foot}
        </div>
      ),
      { width: W, height: H, fonts: fontSet, headers: IMG_HEADERS },
    );

  /* ---------------- board ----------------
     The card every link to the home page unfurls as, so it has to be the
     product. It used to ask "Is this tokenized stock real?" over a bar chart of
     memecoin volume per stock, which was the pitch when this was Ticker Wars
     and sells the wrong thing now that the site is a rating.

     The four band tiles carry it. At the size a timeline renders this, the
     headline is readable and the tiles are the only other thing that is, so
     they have to say what the site does on their own: four letters, four
     counts, four colours. The unrated figure goes in the footer rather than a
     fifth tile, because it is an order of magnitude larger than the rest and a
     tile sized to it would make the four that matter look like rounding. */
  if (key === "BOARD" || key === "INDEX") {
    const T = idx.totals;
    const best = idx.stocks
      .filter((x) => isRated(x.rating))
      .sort((a, b) => (b.rating as Rating).score - (a.rating as Rating).score)
      .slice(0, 3);

    const TILE = 254, TGAP = 24;
    return shell(
      <div style={col({ flex: 1, justifyContent: "space-between", paddingTop: 10, paddingBottom: 6 })}>
        <div style={col()}>
          <div style={{ ...serif(58, 800, PAPER), lineHeight: 1 }}>Every tokenized stock</div>
          <div style={{ ...serif(58, 800, PAPER), lineHeight: 1, marginTop: 6 }}>
            {/* Satori drops whitespace between a text node and a span, so the
                gap before the coloured word is set explicitly. */}
            on Solana,<span style={{ color: BRASS, marginLeft: 16 }}>indexed</span>.
          </div>
          <div style={mono(22, 400, MUTED)}>
            <span style={{ marginTop: 13 }}>
              {T.universe.toLocaleString()} listings, seven issuers. The{" "}
              {T.tradeable} with a market are rated.
            </span>
          </div>
        </div>

        <div style={row({ marginTop: 6 })}>
          {BANDS.map((b, i) => {
            const n = T.ratings[b.band] ?? 0;
            const c = BAND_COLOR[b.band];
            return (
              <div key={b.band} style={col({
                width: TILE, marginRight: i === BANDS.length - 1 ? 0 : TGAP,
                border: `3px solid ${c}`, padding: "16px 20px 18px",
              })}>
                <div style={row({ alignItems: "flex-end" })}>
                  <div style={{ ...serif(74, 800, c), lineHeight: 1 }}>{b.letter}</div>
                  <div style={{ ...serif(58, 800, PAPER), lineHeight: 1, marginLeft: "auto" }}>{n}</div>
                </div>
                <div style={{ ...mono(21, 600, c), letterSpacing: 1.6, marginTop: 12 }}>
                  {b.label.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>

        <div style={row({ marginTop: 4 })}>
          {best.map((x, i) => (
            <div key={x.mint} style={row({ marginRight: 34 })}>
              <div style={mono(20, 600, BRASS)}>{(x.rating as Rating).score}</div>
              <div style={{ ...mono(20, 400, MUTED), marginLeft: 10 }}>
                {cut(clean(x.name) || x.symbol, 18)}
              </div>
              {i < best.length - 1 && <div style={mono(20, 400, LINE)}>&nbsp;</div>}
            </div>
          ))}
        </div>
      </div>,
      <Footer bits={[
        `${T.ratings.unrated.toLocaleString()} unrated, nothing was ever funded behind them`,
        `${T.withPerp} have a perp`,
      ]} />,
    );
  }

  /* ---------------- one denominator ---------------- */
  const s: StockRow | undefined = idx.stocks.find(
    (x) => x.symbol.toUpperCase() === key || x.underlying === key,
  );

  /* A ticker nobody has ever issued gets no picture. The helpful "nothing is
     priced in X, try these" card was a nice touch for a typo and a free image
     renderer for anybody enumerating strings. Tickers that exist but have no
     coins quoted against them still get their card. */
  if (!s) return new Response("Not found", { status: 404, headers: IMG_HEADERS });

  const issuerLabel = s.issuer;
  const redeem = REDEMPTION[s.issuer];

  /* ---------------- the rating ----------------
     The default card, because the rating is what this site is for. The old
     card led with how many memecoins were priced in the stock, which was the
     subject back when this was Ticker Wars and is now a footnote on the page.
     It is still reachable at ?view=coins, since that story is worth its own
     picture, just not the one attached to every link. */
  if (new URL(req.url).searchParams.get("view") !== "coins") {
    const r = s.rating;
    /* The stock's own pool, not the memecoin pools quoted against it.
       quotedLiquidity is a different number measuring a different thing, and
       printing it under a liquidity score computed from s.liquidity put a
       figure on the card that contradicted the bar above it. */
    const foot = [
      `${usd(s.liquidity)} liquidity`,
      `${usd(s.volume24h)} 24h volume`,
      redeem ? CLAIM_LABEL[redeem.claim].toLowerCase() : null,
    ].filter(Boolean) as string[];

    return shell(
      <div style={col({ flex: 1, justifyContent: "space-between", paddingTop: 20, paddingBottom: 10 })}>
        <div style={row({ justifyContent: "space-between", alignItems: "flex-start" })}>
          {isRated(r) ? <Verdict rating={r} /> : (
            <div style={row({ alignItems: "flex-start" })}>
              <div style={col({
                width: 168, height: 168, border: `4px solid ${LINE}`,
                alignItems: "center", justifyContent: "center", marginRight: 30,
              })}>
                <div style={{ ...serif(132, 800, FAINT), lineHeight: 1 }}>&ndash;</div>
              </div>
              <div style={col({ paddingTop: 34 })}>
                <div style={{ ...mono(30, 600, MUTED), letterSpacing: 2 }}>NOT RATED</div>
                <div style={{ ...mono(22, 400, FAINT), marginTop: 16, maxWidth: 440 }}>
                  {r && "reason" in r ? r.reason : "Nothing here to measure yet."}
                </div>
              </div>
            </div>
          )}
          <div style={col({ alignItems: "flex-end", maxWidth: 440, paddingTop: 4 })}>
            <div style={{ ...serif(72, 800, PAPER), lineHeight: 1 }}>{cut(s.symbol, 11)}</div>
            <div style={mono(23, 400, MUTED)}>
              <span style={{ marginTop: 12 }}>{cut(clean(s.name), 28)}</span>
            </div>
            <div style={mono(23, 400, FAINT)}>
              <span style={{ marginTop: 6 }}>{issuerLabel}</span>
            </div>
          </div>
        </div>

        {isRated(r) ? (
          <div style={col({ marginTop: 10 })}>
            {r.pillars.map((p) => (
              <PillarRow
                key={p.key} label={p.label} score={p.score}
                weight={p.weight} color={BAND_COLOR[r.band]}
              />
            ))}
          </div>
        ) : (
          <div style={col({ marginTop: 10 })}>
            <div style={{ ...serif(44, 800, PAPER), lineHeight: 1.2, maxWidth: 1000 }}>
              Listed, and nobody has funded a market behind it.
            </div>
            <div style={mono(22, 400, MUTED)}>
              <span style={{ marginTop: 18 }}>
                {idx.totals.universe.toLocaleString()} tokenized stocks are listed on Solana
                and {idx.totals.tradeable} of them have one.
              </span>
            </div>
          </div>
        )}
      </div>,
      <Footer bits={foot} warn={s.has247Feed ? undefined : "NO 24/7 ORACLE"} />,
    );
  }

  /* ---------------- what is priced in it ---------------- */
  if (s.quotedCount === 0) {
    const avail = idx.stocks.filter((x) => x.quotedCount > 0).slice(0, 10)
      .map((x) => x.symbol).join("  ");
    return shell(
      <div style={col({ flex: 1, justifyContent: "center" })}>
        <div style={serif(58, 800, PAPER)}>Nothing is priced in {cut(key, 14)}.</div>
        <div style={mono(20, 400, MUTED)}>
          <span style={{ marginTop: 18 }}>Try: {avail}</span>
        </div>
      </div>,
      <Footer bits={[`${idx.totals.denominators} stocks are being used as denominators`]} />,
    );
  }

  // One row per coin. A coin with several pools was showing up three times,
  // which reads as a rendering fault rather than as real liquidity spread.
  const seen = new Set<string>();
  const top = s.quotedCoins
    .filter((c) => {
      const k = c.coin.toUpperCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
  const issuerName = s.issuer;
  const max = Math.max(...top.map((c) => c.volume24h), 1);

  return shell(
    <div style={col({ flex: 1, justifyContent: "space-between", paddingTop: 22, paddingBottom: 14 })}>
      <div style={row({ justifyContent: "space-between", alignItems: "flex-start" })}>
        <div style={col({ maxWidth: 560 })}>
          <div style={serif(96, 800, PAPER)}>{cut(s.symbol, 9)}</div>
          <div style={mono(21, 400, MUTED)}>
            <span style={{ marginTop: 8 }}>{cut(clean(s.name), 30)} · {issuerName}</span>
          </div>
        </div>
        <div style={col({ alignItems: "flex-end", maxWidth: 420 })}>
          <div style={serif(88, 800, BRASS)}>{s.quotedCount}</div>
          <div style={mono(21, 400, MUTED)}>
            <span style={{ marginTop: 4 }}>coins are priced in this stock</span>
          </div>
        </div>
      </div>

      <div style={col({ marginTop: 22 })}>
        {top.map((c, i) => (
          <div key={(c.coinMint ?? "") + i} style={row({ height: 50, borderBottom: `1px solid ${LINE}` })}>
            <div style={{ ...mono(25, 600, PAPER), width: 300 }}>{cut(c.coin, 17)}</div>
            <Bar pct={(c.volume24h / max) * 100} />
            <div style={{ ...mono(23, 600, PAPER), width: 118, justifyContent: "flex-end" }}>
              {usd(c.volume24h)}
            </div>
          </div>
        ))}
      </div>
    </div>,
    <Footer
      bits={[`${usd(s.quotedVolume24h)} 24h volume`, `${usd(s.quotedLiquidity)} liquidity`]}
      warn={s.has247Feed ? undefined : "NO 24/7 ORACLE"}
    />,
  );
}
