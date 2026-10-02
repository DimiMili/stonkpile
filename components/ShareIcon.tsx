"use client";

import { useEffect, useState } from "react";

/**
 * The share glyph the person already knows.
 *
 * There is no universal share icon. Apple platforms use a tray with an arrow
 * rising out of it, Android and most of the web use three connected nodes, and
 * the two are not interchangeable: an Android user reads the Apple tray as an
 * upload button, and an iPhone user does not read the node graph as sharing at
 * all. So the button wears whichever one its platform taught the person to
 * recognise, and the word "Share" sits next to it for anyone the icon misses.
 *
 * These are drawn here as plain geometry rather than lifted from a vendor's
 * icon set: a rounded tray with an arrow, and three dots joined by two lines.
 * Both are the generic convention rather than any one company's artwork.
 *
 * Detection runs after mount, never during render. The server has no user
 * agent, so deciding at render time would mean the server and the browser
 * disagreeing about which path to draw, which React reports as a hydration
 * error. Until it resolves, the neutral glyph shows.
 */

export type Platform = "apple" | "android" | "other";

export function usePlatform(): Platform {
  const [p, setP] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const touch = navigator.maxTouchPoints || 0;
    // iPadOS reports itself as a Mac, and the only thing separating the two is
    // that the iPad has a touchscreen.
    const apple = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && touch > 1) || /Mac/.test(ua);
    if (/Android/.test(ua)) setP("android");
    else if (apple) setP("apple");
    else setP("other");
  }, []);

  return p;
}

export function ShareIcon({ platform, size = 15 }: { platform: Platform; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: "false" as const,
  };

  if (platform === "apple") {
    // Tray open at the top, with an arrow rising out of it.
    return (
      <svg {...common}>
        <path d="M12 15V3" />
        <path d="M8 7l4-4 4 4" />
        <path d="M6 12v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7" />
      </svg>
    );
  }

  // Android and everywhere else: three nodes joined by two lines.
  return (
    <svg {...common}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.8l7.4-4.3" />
      <path d="M8.3 13.2l7.4 4.3" />
    </svg>
  );
}
