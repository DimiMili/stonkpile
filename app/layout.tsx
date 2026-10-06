import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { PinkSheets } from "@/components/PinkSheets";

const TITLE = "Stonkpile";

/* The unfurl, which for most people is the whole site.
   All three parts of it were still selling Ticker Wars: a title about Wall
   Street being the denominator, a description about memecoins quoted against
   stocks, and a card asking whether a token is real over a bar chart of
   memecoin volume. That was the product three weeks ago.

   No counts in here. This is a static export with no index behind it, so any
   number typed here is frozen at the moment it was written, which is the exact
   fault the hero carried until 5 October. The card renders live and carries
   the figures. */
const SHOUT = "Every tokenized stock on Solana, rated.";
const DESC =
  "Every tokenized stock on Solana with a market gets a rating out of 100 for the market around it: " +
  "liquidity, real volume, pools and perps, and pricing. The ones with nothing behind them get a reason instead. " +
  "Across xStocks, Backpack, Ondo, PreStocks, Tessera, Securitize and Superstate.";

/* Social crawlers cache per image URL and never come back, so a redesigned card
   behind an unchanged URL is a card nobody sees. Bump this when the card's
   design changes; it does not need to track the data, which the CDN handles. */
const CARD = `${siteUrl}/api/card/board.png?v=rating1`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: TITLE, template: "%s · Stonkpile" },
  description: DESC,
  openGraph: {
    title: SHOUT,
    description: DESC,
    type: "website",
    url: siteUrl,
    siteName: TITLE,
    images: [{ url: CARD, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SHOUT,
    description: DESC,
    images: [CARD],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the inline script below writes data-theme before React sees the document
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Replays the hidden theme before first paint so there is no flash of
            the default palette on a page change. Kept inline and tiny on
            purpose: it must run before the stylesheet applies. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('sp-theme')==='pink')document.documentElement.dataset.theme='pink'}catch(e){}",
          }}
        />
        {/* psst: type pink */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;0,6..96,800;1,6..96,400&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        {children}
        <PinkSheets />
        <Analytics />
      </body>
    </html>
  );
}
