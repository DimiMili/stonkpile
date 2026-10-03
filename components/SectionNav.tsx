"use client";

import { useEffect, useState } from "react";

/**
 * Shortcuts to every section, pinned to the top of the window.
 *
 * This page is around 13,000 pixels tall. A set of links that only exists at
 * the very top is useless by the time someone is deep enough to want them, and
 * a block of descriptive cards up there just adds to the height it is meant to
 * solve. So this is one compact row that sticks: wherever you are, the whole
 * page is one tap away, and the pill for the section you are currently in is
 * marked so the row doubles as a position indicator.
 *
 * It scrolls sideways on a phone rather than wrapping onto a second line,
 * because two rows of chrome at the top of a small screen is worse than one row
 * you can flick.
 */
const SECTIONS = [
  { id: "check", label: "Check a ticker" },
  { id: "history", label: "Movement" },
  { id: "depth", label: "Where the money is" },
  { id: "churn", label: "Real volume" },
  { id: "issuers", label: "Issuers" },
  { id: "board", label: "Board" },
  { id: "accrual", label: "Quiet growth" },
  { id: "coins", label: "Coins" },
  { id: "prices", label: "Two prices" },
  { id: "oracle", label: "Oracle gap" },
];

export function SectionNav() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    // The section whose top is nearest the band just under the sticky bar wins.
    // Simple and stable: a pure "is it on screen" test flickers between two
    // sections whenever a boundary sits mid-viewport.
    const pick = () => {
      let best = "";
      let bestTop = -Infinity;
      for (const el of els) {
        const top = el.getBoundingClientRect().top - 90;
        if (top <= 0 && top > bestTop) {
          bestTop = top;
          best = el.id;
        }
      }
      setActive(best);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, []);

  return (
    <nav className="snav" aria-label="Sections of this page">
      <div className="snav-row">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={active === s.id ? "on" : undefined}
            aria-current={active === s.id ? "true" : undefined}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
