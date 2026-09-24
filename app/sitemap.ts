import type { MetadataRoute } from "next";
import { buildIndex } from "@/lib/pipeline";
import { siteUrl } from "@/lib/site";

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
  ];

  for (const s of idx.stocks) {
    if (s.quotedCount === 0) continue;
    pages.push({
      url: `${siteUrl}/s/${s.symbol}`,
      lastModified: now,
      changeFrequency: "hourly",
      // the denominators carrying real volume matter more than the tail
      priority: s.quotedVolume24h > 1_000_000 ? 0.8 : 0.6,
    });
  }

  return pages;
}
