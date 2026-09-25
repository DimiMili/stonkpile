"use client";

import { useState } from "react";

/**
 * The share block. Every ticker page renders a live card, and until now nothing
 * told anyone it existed: the only pointer was a footer link reading "Share
 * card" next to "JSON". Cards are the distribution mechanic, so they need to be
 * visible and one click from posted.
 *
 * Why this goes through the native share sheet rather than straight to an X
 * intent URL: on a phone the intent URL opens in the browser, and most people
 * who use X are signed in to the app, not to x.com in Safari. They get a
 * sign-in wall where the composer should be, with no way to click past it. The
 * same applies to anyone who opens a link from inside another app's web view.
 * navigator.share hands off to the installed app instead, session and all. The
 * intent URL stays as the fallback for browsers with no share API, which is
 * mostly desktop, where being signed in to the website is the normal case.
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

  /* Decided inside the handler, not at render: reading navigator during render
     would disagree with the server pass and break hydration. */
  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (err) {
        // The sheet was dismissed on purpose. Opening X afterwards would be
        // the opposite of what they just asked for.
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    window.open(post, "_blank", "noopener,noreferrer");
  };

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
        <button className="btn primary" onClick={share} type="button">
          Share
        </button>
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
