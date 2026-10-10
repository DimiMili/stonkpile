import type { Metadata } from "next";
import { SiteMark, Wordmark } from "@/components/SiteMark";

/**
 * The brand page.
 *
 * It exists because people were going to use the mark whether or not there was
 * a right way to: a hackathon form wanting a logo, a write-up wanting an avatar,
 * an aggregator pulling whatever favicon it found. A page that hands them the
 * correct file, at the correct size, costs an evening and saves every bad
 * screenshot after it.
 *
 * Everything on it is the real thing rather than a picture of it: the mark is
 * the same component the header renders, and the swatches read the same custom
 * properties the rest of the site does, so this page cannot drift out of date
 * while the site changes underneath it.
 */
export const metadata: Metadata = {
  title: "Brand",
  description:
    "The Stonkpile mark, palette and typefaces, with the files to use them properly.",
};

const SWATCHES: { name: string; token: string; light: string; dark: string; use: string }[] = [
  { name: "Paper", token: "--bg", light: "#ECEEE8", dark: "#0F1218", use: "The page" },
  { name: "Ink", token: "--ink", light: "#161A21", dark: "#E7EAE8", use: "Body and headings" },
  { name: "Brass", token: "--brass", light: "#8D6414", dark: "#D9AE51", use: "The one accent" },
  { name: "Muted", token: "--muted", light: "#5D6672", dark: "#929BA7", use: "Secondary text" },
  { name: "Line", token: "--line", light: "#D4D7CE", dark: "#262C36", use: "Borders and rules" },
  { name: "Up", token: "--up", light: "#146B48", dark: "#41CB8B", use: "Gains, passes" },
  { name: "Down", token: "--down", light: "#A8352E", dark: "#EF6D62", use: "Falls, failures" },
];

const FILES: { file: string; what: string; when: string }[] = [
  { file: "mark.svg", what: "Mark on its own dark tile, rounded", when: "App icons, anywhere the background is not ours" },
  { file: "mark-square.svg", what: "Same, full bleed, no rounding", when: "Avatars, where the platform does its own cropping" },
  { file: "mark-white.svg", what: "Bare mark, light columns", when: "On a dark background we control" },
  { file: "mark-ink.svg", what: "Bare mark, dark columns", when: "On a light background we control" },
  { file: "mark-maskable.svg", what: "Mark inset to 62 percent", when: "Android home screens, which crop to a circle" },
  { file: "avatar-1000.png", what: "1000 × 1000 PNG", when: "Profile pictures, and any form asking for a logo image" },
  { file: "x-header-1500x500.png", what: "1500 × 500 PNG", when: "The X header" },
  { file: "icon-512.png", what: "512 × 512 PNG", when: "Web app manifests" },
  { file: "favicon.ico", what: "16, 32 and 48 in one file", when: "Browser tabs on older browsers" },
];

export default function BrandPage() {
  return (
    <div className="wrap">
      <header>
        <Wordmark />
        <p className="eyebrow">
          <span>Brand</span>
          <span className="dot">/</span>
          <span>Free to use, within reason</span>
        </p>
        <h1>The mark, the palette, and the <em>files</em>.</h1>
        <p className="standfirst">
          Everything here is the same code the site runs on, so it cannot go stale. Take what
          you need. If you are writing about Stonkpile, you do not need to ask.
        </p>
      </header>

      <section>
        <h2>The mark</h2>
        <p className="sec-note">
          Four columns, the third one graded. It is a market with one thing in it rated, which
          is the whole product in four shapes. The graded column is always the third and always
          the tallest; it is the only part that carries the accent colour.
        </p>
        <div className="brand-grid">
          <div className="brand-cell brand-light">
            <SiteMark size={72} />
            <p className="brand-cap">On paper</p>
          </div>
          <div className="brand-cell brand-dark">
            <SiteMark size={72} />
            <p className="brand-cap">On ink</p>
          </div>
          <div className="brand-cell brand-light">
            <span className="brand-lock"><SiteMark size={34} /><b>Stonkpile</b></span>
            <p className="brand-cap">Locked up with the name</p>
          </div>
          <div className="brand-cell brand-light">
            <SiteMark size={24} />
            <p className="brand-cap">Smallest it goes: 24px</p>
          </div>
        </div>
        <p className="lookfor">
          <span className="k">Rules, and there are only four</span>
          Keep clear space around it equal to the width of one column. Never redraw it, restretch
          it, or rotate it. Never recolour the three plain columns to anything but the ink or the
          paper tone. Never put the mark on a background that leaves the graded column with less
          than 3:1 contrast.
        </p>
      </section>

      <section>
        <h2>Colour</h2>
        <p className="sec-note">
          Two grounds and one accent. Brass is the only colour that ever means anything: it marks
          the thing being rated, the live indicator, and a link. Green and red appear only on
          numbers that moved, never as decoration.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Token</th><th>Light</th><th>Dark</th><th>What it is for</th></tr>
            </thead>
            <tbody>
              {SWATCHES.map((s) => (
                <tr key={s.token}>
                  <td>
                    <span className="sw" style={{ background: s.light }} aria-hidden="true" />
                    <span className="sw sw-pair" style={{ background: s.dark }} aria-hidden="true" />
                    {" "}{s.name}
                  </td>
                  <td className="dex">{s.token}</td>
                  <td className="num">{s.light}</td>
                  <td className="num">{s.dark}</td>
                  <td className="dex">{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Type</h2>
        <p className="sec-note">
          Three faces, one job each. All three are on Google Fonts and free to use.
        </p>
        <div className="brand-type">
          <div className="brand-face">
            <p className="brand-spec">Bodoni Moda &middot; 600, 800</p>
            <p className="brand-sample brand-display">Every tokenized stock</p>
            <p className="brand-note">
              Headlines and any number worth looking at. Weight 600 everywhere except the one
              headline on a page. Negative tracking, always: &minus;0.015em on display, &minus;0.01em
              on section headings.
            </p>
          </div>
          <div className="brand-face">
            <p className="brand-spec">Archivo &middot; 400, 500, 600</p>
            <p className="brand-sample">Prose, and anything somebody has to read a paragraph of.</p>
            <p className="brand-note">
              The body face. It never appears above 40px and never carries an accent colour.
            </p>
          </div>
          <div className="brand-face">
            <p className="brand-spec">IBM Plex Mono &middot; 400, 500, 600</p>
            <p className="brand-sample brand-mono">LABELS, TICKERS, ADDRESSES</p>
            <p className="brand-note">
              Everything a machine produced: tickers, contract addresses, column headers, the
              eyebrow. Uppercase with 0.13em tracking when it is a label.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Files</h2>
        <p className="sec-note">
          Pick by what the background is doing, not by what looks nicest in the list. Vector
          wherever vector is allowed.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>File</th><th>What it is</th><th>When to use it</th></tr>
            </thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.file}>
                  <td>
                    <a className="coin" href={`/brand/stonkpile/${f.file}`} download>{f.file}</a>
                  </td>
                  <td className="dex">{f.what}</td>
                  <td className="dex">{f.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ca-line">
          <span className="k">All of it</span>
          <a href="/brand/stonkpile-brand-kit.zip" download>Download the kit</a>
        </p>
      </section>

      <section>
        <h2>The name</h2>
        <p className="sec-note">
          Stonkpile, one word, capital S, no space and no camel case. Not StonkPile, not Stonk
          Pile. The site is stonkpile.xyz. If you are describing it in a sentence: an index of
          every tokenized stock on Solana, with a rating for the ones that have a market.
        </p>
      </section>

      <footer>
        <span>
          <a href="/">The board</a> &middot; <a href="/api/index">JSON</a> &middot;{" "}
          <a href="https://github.com/DimiMili/stonkpile" target="_blank" rel="noopener noreferrer">GitHub</a>
        </span>
        <span>Open source, MIT. The mark is ours; the code is yours.</span>
      </footer>
    </div>
  );
}
