import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Nothing is disallowed, and /api/card/ in particular must stay open:
      // Twitterbot, Slackbot, Discordbot, TelegramBot and every other unfurl
      // service respects robots.txt, so blocking that path silently kills
      // every share card on every platform. The cards are cheap and cached.
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
