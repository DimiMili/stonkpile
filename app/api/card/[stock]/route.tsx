import { ImageResponse } from "next/og";
import { buildIndex, type StockRow, type Index } from "@/lib/pipeline";
import { fonts } from "@/lib/fonts";

export const runtime = "nodejs";
export const revalidate = 300;

const W = 1200, H = 630;
const INK = "#0f1218", PAPER = "#e9ebe6", MUTED = "#8b94a0",
      FAINT = "#5b6470", BRASS = "#d9ae51", LINE = "#242a34",
      TRACK = "#20262f", DOWN = "#ef6d62", UP = "#41cb8b";

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
  _req: Request,
  { params }: { params: Promise<{ stock: string }> },
) {
  const { stock: raw } = await params;
  const key = raw.replace(/\.(png|jpg|jpeg)$/i, "").toUpperCase();
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

  /* ---------------- board ---------------- */
  if (key === "BOARD" || key === "INDEX") {
    const T = idx.totals;
    const rows = idx.stocks.filter((s) => s.quotedCount > 0).slice(0, 5);
    const max = Math.max(...rows.map((r) => r.quotedVolume24h), 1);

    return shell(
      <div style={col({ flex: 1, justifyContent: "center", paddingTop: 4 })}>
        <div style={{ ...serif(64, 800, PAPER), lineHeight: 1 }}>Wall Street is the</div>
        <div style={{ ...serif(64, 800, BRASS), lineHeight: 1, marginTop: 4 }}>
          denominator now.
        </div>
        <div style={mono(21, 400, MUTED)}>
          <span style={{ marginTop: 16 }}>
            {T.quotedCoins.toLocaleString()} coins on Solana are priced in tokenized stocks, not SOL.
          </span>
        </div>
        <div style={col({ marginTop: 22 })}>
          {rows.map((r) => (
            <div key={r.mint} style={row({ height: 46, borderBottom: `1px solid ${LINE}` })}>
              <div style={{ ...serif(30, 600, PAPER), width: 132 }}>{r.symbol}</div>
              <div style={{ ...mono(19, 400, MUTED), width: 120 }}>{r.quotedCount} coins</div>
              <Bar pct={(r.quotedVolume24h / max) * 100} />
              <div style={{ ...mono(22, 600, PAPER), width: 118, justifyContent: "flex-end" }}>
                {usd(r.quotedVolume24h)}
              </div>
            </div>
          ))}
        </div>
      </div>,
      <Footer bits={[
        `${T.universe.toLocaleString()} tokenized stocks listed`,
        `${T.tradeable} actually trade`,
        `${T.with247Feed}/${T.denominators} have a 24/7 oracle`,
      ]} />,
    );
  }

  /* ---------------- one denominator ---------------- */
  const s: StockRow | undefined = idx.stocks.find(
    (x) => x.symbol.toUpperCase() === key || x.underlying === key,
  );

  if (!s || s.quotedCount === 0) {
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
  const issuerName = s.issuer === "Backpack" ? "Sunrise" : s.issuer;
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
