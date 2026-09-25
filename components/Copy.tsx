"use client";

import { useState } from "react";

/**
 * A contract address you can take away with you.
 *
 * The point of the whole issuer check is that somebody ends up pasting an
 * address into a wallet. Making them retype it off the screen, or go and find
 * it somewhere else, is where a fake gets its chance. So the address lives next
 * to the verdict, and one tap copies it.
 *
 * Two rules this component exists to keep:
 *   - what it copies is always the full address, never the shortened form on
 *     screen, so a truncated paste can never happen;
 *   - when the clipboard is unavailable, it shows the whole address instead of
 *     failing silently, because a button that looks like it worked and did not
 *     is worse than no button.
 */
export function Copy({
  value,
  label = "copy",
  tone,
}: {
  value: string;
  /** Overridden on rows where copying the address is not the safe thing to do. */
  label?: string;
  tone?: "bad";
}) {
  const [state, setState] = useState<"idle" | "done" | "manual">("idle");

  const short = `${value.slice(0, 4)}…${value.slice(-4)}`;

  const copy = async (e: React.MouseEvent) => {
    // These sit inside link rows. Without this, copying navigates away.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("manual");
    }
  };

  if (state === "manual") {
    return (
      <span className={`ca ca-manual${tone === "bad" ? " ca-bad" : ""}`}>
        <span className="ca-full">{value}</span>
        <span className="ca-act">select and copy</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`ca${tone === "bad" ? " ca-bad" : ""}`}
      onClick={copy}
      title={value}
      aria-label={`Copy contract address ${value}`}
    >
      <span className="ca-addr">{short}</span>
      <span className="ca-act">{state === "done" ? "copied" : label}</span>
    </button>
  );
}
