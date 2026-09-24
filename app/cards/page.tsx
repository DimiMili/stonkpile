import { buildIndex } from "@/lib/pipeline";

export const revalidate = 300;

export const metadata = { title: "Stonkpile cards" };

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

export default async function Cards() {
  const idx = await buildIndex();
  const rows = idx.stocks.filter((s) => s.quotedCount > 0).slice(0, 24);

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">
          <span>Share cards</span>
          <span className="dot">/</span>
          <span>1200 × 630</span>
        </p>
        <h1>
          One card <em>per denominator</em>.
        </h1>
        <p className="standfirst">
          Every card renders live from the index, so the numbers are current the moment
          someone opens the link. Right-click to save, or post the URL directly and let
          the unfurl do the work.
        </p>
      </header>

      <section>
        <h2>The board</h2>
        <p className="sec-note">The summary card. Use this one for the top of a thread.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/card/board.png"
          alt="Stonkpile board card"
          width={1200}
          height={630}
          style={{ width: "100%", height: "auto", border: "1px solid var(--line)" }}
        />
        <p className="sec-note" style={{ marginTop: 10 }}>
          <a href="/api/card/board.png">/api/card/board.png</a>
        </p>
      </section>

      <section>
        <h2>Per stock</h2>
        <p className="sec-note">
          {rows.length} stocks currently carry coins. Any symbol or underlying ticker works:
          <code> /api/card/LMT.png</code>, <code> /api/card/GMEx.png</code>,
          <code> /api/card/GME.png</code>.
        </p>
        <div className="cardgrid">
          {rows.map((s) => (
            <a key={s.mint} className="cardcell" href={`/api/card/${s.symbol}.png`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/card/${s.symbol}.png`}
                alt={`${s.symbol} card`}
                width={1200}
                height={630}
                loading="lazy"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              <div className="cardmeta">
                <span>{s.symbol}</span>
                <span>
                  {s.quotedCount} coins · {usd(s.quotedVolume24h)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <span>
          <a href="/">Back to the board</a> · <a href="/api/index">JSON API</a>
        </span>
        <span>Updated {idx.generatedAt.slice(0, 16).replace("T", " ")} UTC</span>
      </footer>
    </div>
  );
}
