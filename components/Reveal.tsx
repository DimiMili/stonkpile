"use client";

import { useRef } from "react";

/**
 * A section that opens.
 *
 * The page is thirteen thousand pixels tall and a reader told us, in as many
 * words, that he had no idea how to use it. The fix is not fewer facts, it is
 * fewer at once: every section keeps its headline and its one finding, and the
 * table goes behind a tap.
 *
 * The risk in collapsing is that a closed section is a dead one, so nothing
 * here hides the payoff. What stays visible is the headline, the "right now"
 * sentence, and a count of what is inside. Those finding lines were already the
 * best writing on the site and they now do the job they were always suited to:
 * a reason to open, rather than a caption on something you were going to scroll
 * past anyway.
 *
 * Built on <details> rather than a state hook, which buys three things that are
 * tedious to rebuild by hand: it works before React hydrates, the keyboard and
 * screen reader behaviour is the browser's own, and ctrl-F opens a closed
 * section to reach a match inside it. The height animates where the browser
 * supports interpolate-size and ::details-content, and simply snaps where it
 * does not, which is the correct way round.
 *
 * The control sits under the preview, which is where a "show more" belongs and
 * where this one was asked for. The one cost of that is closing: the pill on an
 * open section is at the foot of it, so a tap there would leave the reader
 * stranded at whatever the page collapsed to. Hence the one piece of script in
 * here, which puts the section's own headline back on screen on the way out.
 * Everything else is still the browser's.
 */
export function Reveal({
  label,
  count,
  open = false,
  peek,
  children,
}: {
  /** What is inside, as a noun the reader recognises: "the ranked table". */
  label: string;
  /** How much is inside. A number is a stronger invitation than a chevron. */
  count?: string;
  open?: boolean;
  /** How much of the body shows while closed. Taller for charts than tables. */
  peek?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  // On close only, and only when the section has scrolled off the top: bring
  // its heading back under the sticky nav. Opening is left alone, because the
  // content grows downward from where the reader already is.
  const onToggle = () => {
    const el = ref.current;
    if (!el || el.open) return;
    const anchor = (el.closest("section") as HTMLElement | null) ?? el;
    const put = () => {
      const top = anchor.getBoundingClientRect().top;
      if (top < 72) window.scrollTo({ top: window.scrollY + top - 88 });
    };
    // Twice: once now, and once after the height animation, because the page
    // keeps shrinking under the scroll position for the length of the
    // transition and the browser clamps to the new maximum as it goes. One
    // call lands 128px short, measured.
    put();
    setTimeout(put, 400);
  };

  return (
    <details
      ref={ref}
      onToggle={onToggle}
      className="reveal"
      open={open}
      style={peek ? ({ ["--peek" as string]: `${peek}px` }) : undefined}
    >
      <summary className="reveal-sum">
        {/* Both labels ship; CSS shows one. The control now sits under the
            preview, so an open section would otherwise carry a button reading
            "Show the chart" directly beneath the chart it already showed. */}
        <span className="reveal-open">{label}</span>
        <span className="reveal-close">Hide</span>
        {count && <span className="reveal-count">{count}</span>}
        <span className="reveal-mark" aria-hidden="true" />
      </summary>
      <div className="reveal-body">{children}</div>
    </details>
  );
}
