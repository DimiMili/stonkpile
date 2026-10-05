import type { MetadataRoute } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";
import { isRated } from "@/lib/rating";

export const revalidate = 3600;

/**
 * Every stock that is actually used as a denominator gets a share page, and
 * until now none of them were discoverable. Ticker pages are the long tail:
 * someone searching "GMEx" or "tokenized NVIDIA" should land on ours.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const idx = await buildIndex();
  const now = new Date(idx.generatedAt);

  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/cards`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    // The three sections that get shared on their own, each with its own card.
    // An anchor link cannot carry one, because the part after the hash never
    // reaches the server.
    { url: `${siteUrl}/rating`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/earning`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/volume`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];

  /* Every rated stock, not only the ones carrying memecoins. The quotedCount
     filter was hiding nine pages from search entirely, including Intel and
     Robinhood, which are rated and are what somebody searching "tokenized
     Intel" is looking for. */
  for (const s of idx.stocks) {
    if (!isRated(s.rating)) continue;
    pages.push({
      url: `${siteUrl}/s/${s.symbol}`,
      lastModified: now,
      changeFrequency: "hourly",
      // a better-rated market is the more useful page to land on
      priority: s.rating.score >= 80 ? 0.8 : s.rating.score >= 62 ? 0.7 : 0.6,
    });
  }

  return pages;
}
