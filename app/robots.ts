import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // The card renderer is an image endpoint with a per-ticker URL space.
      // Crawlers indexing it would burn the function budget for nothing, and
      // the cards are already surfaced through og:image on the pages.
      { userAgent: "*", allow: "/", disallow: ["/api/card/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
