import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { PinkSheets } from "@/components/PinkSheets";

const TITLE = "Stonkpile";
const DESC =
  "Every memecoin on Solana quoted against a tokenized stock. Live index across xStocks, Sunrise, Ondo, PreStocks and Tessera.";
const CARD = `${siteUrl}/api/card/board.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: TITLE, template: "%s · Stonkpile" },
  description: DESC,
  openGraph: {
    title: "Wall Street is the denominator now.",
    description: DESC,
    type: "website",
    url: siteUrl,
    siteName: TITLE,
    images: [{ url: CARD, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wall Street is the denominator now.",
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
