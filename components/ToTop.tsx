"use client";

import { useEffect, useState } from "react";

/**
 * Back to the top.
 *
 * This page is around 13,000 pixels tall, so from the oracle section the search
 * box is a very long way away and on a phone it is the only way back without
 * flicking for several seconds. Hidden until there is something to go back to,
 * so it never covers content on the first screen.
 *
 * It moves the focus as well as the scroll position, otherwise a keyboard user
 * is returned to the top visually and left tabbing from wherever they were.
 */
export function ToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 1400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      className="totop"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const input = document.getElementById("ticker");
        if (input) (input as HTMLInputElement).focus({ preventScroll: true });
      }}
    >
      <span aria-hidden="true">↑</span> Top
    </button>
  );
}
