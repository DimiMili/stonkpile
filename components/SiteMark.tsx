/**
 * The Stonkpile mark: four columns, the third graded.
 *
 * Inline rather than an <img> so it inherits the page. The three plain columns
 * are currentColor, so they are ink on the light theme and paper on the dark one
 * without shipping two files, and the graded one is the brass token, so it moves
 * if the palette ever does.
 *
 * No tile here on purpose. The tile exists on the favicon and the avatar, which
 * sit on backgrounds we do not control. On our own page it would be a black
 * square that disappears in dark mode, which is a worse result than no square.
 */
export function SiteMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Stonkpile"
      focusable="false"
    >
      <rect x="7.5" y="32" width="16" height="36" rx="8" fill="currentColor" />
      <rect x="30.5" y="18" width="16" height="64" rx="8" fill="currentColor" />
      <rect x="53.5" y="9" width="16" height="82" rx="8" fill="var(--brass)" />
      <rect x="76.5" y="29" width="16" height="42" rx="8" fill="currentColor" />
    </svg>
  );
}

/**
 * Mark plus wordmark, and the way home.
 *
 * The home page had no wordmark at all until now: the eyebrow said what the site
 * was and nothing said what it was called. Every other page already carried the
 * name as text in that slot, so this is the same lockup everywhere rather than a
 * new element on one page.
 */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <a className="wordmark" href="/">
      <SiteMark size={size} />
      <span>Stonkpile</span>
    </a>
  );
}
