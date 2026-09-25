import type { MetadataRoute } from "next";

/**
 * Installable web app. Add to Home Screen on Android and iOS, and the
 * prerequisite for wrapping this as a Trusted Web Activity later if we take it
 * to the Solana dApp Store, which requires a signed APK rather than a URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stonkpile",
    short_name: "Stonkpile",
    description:
      "Every tokenized stock on Solana and every coin quoted against one. Check if a tokenized stock is real before you touch it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eceee8",
    theme_color: "#eceee8",
    categories: ["finance", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
