"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hidden theme. Type "pink" anywhere on the page to swap the whole site to the
 * salmon quotation-sheet palette, Escape or the corner chip to leave.
 *
 * It is a token swap on <html data-theme>, nothing more: no second layout, no
 * second card renderer, and the default theme still follows the device.
 * The preference is written to localStorage and replayed before first paint by
 * the inline script in app/layout.tsx so it survives a page change.
 */

const CODE = "pink";
const KEY = "sp-theme";

function write(on: boolean) {
  const r = document.documentElement;
  if (on) r.dataset.theme = "pink";
  else delete r.dataset.theme;
  try {
    if (on) localStorage.setItem(KEY, "pink");
    else localStorage.removeItem(KEY);
  } catch {
    // private mode, or storage blocked. The theme still applies for this page.
  }
}

export function PinkSheets() {
  const [on, setOn] = useState(false);

  const apply = useCallback((next: boolean) => {
    write(next);
    setOn(next);
  }, []);

  useEffect(() => {
    // the inline script may already have set it from a previous visit
    setOn(document.documentElement.dataset.theme === "pink");

    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (document.documentElement.dataset.theme === "pink") apply(false);
        return;
      }
      if (e.key.length !== 1) return;

      buf = (buf + e.key.toLowerCase()).slice(-CODE.length);
      if (buf === CODE) {
        buf = "";
        apply(document.documentElement.dataset.theme !== "pink");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply]);

  if (!on) return null;

  return (
    <button className="egg" onClick={() => apply(false)} aria-label="Leave the pink sheets theme">
      Pink sheets <span>esc</span>
    </button>
  );
}
