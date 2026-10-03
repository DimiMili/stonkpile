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
 */
export function Reveal({
  label,
  count,
  open = false,
  children,
}: {
  /** What is inside, as a noun the reader recognises: "the ranked table". */
  label: string;
  /** How much is inside. A number is a stronger invitation than a chevron. */
  count?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="reveal" open={open}>
      <summary className="reveal-sum">
        <span className="reveal-open">{label}</span>
        {count && <span className="reveal-count">{count}</span>}
        <span className="reveal-mark" aria-hidden="true" />
      </summary>
      <div className="reveal-body">{children}</div>
    </details>
  );
}
