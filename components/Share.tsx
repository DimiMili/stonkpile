"use client";

import { useState } from "react";

/**
 * The share block. Every ticker page renders a live card, and until now nothing
 * told anyone it existed: the only pointer was a footer link reading "Share
 * card" next to "JSON". Cards are the distribution mechanic, so they need to be
 * visible and one click from posted.
 */
export function Share({
  url,
  card,
  text,
}: {
  url: string;
  card: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  const post = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the link is visible below anyway
    }
  };

  return (
    <section id="share">
      <h2>Share this</h2>
      <p className="lookfor">
        <span className="k">What people will see</span>
        Post the link anywhere and this card unfurls with it. It renders live, so the
        numbers are correct at the moment somebody opens it, not the moment you posted.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sharecard" src={card} alt="" width={1200} height={630} />

      <div className="shareactions">
        <a className="btn primary" href={post} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <button className="btn" onClick={copy} type="button">
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a className="btn" href={card} download>
          Download card
        </a>
      </div>
    </section>
  );
}
