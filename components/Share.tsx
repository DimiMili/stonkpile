"use client";

import { useState } from "react";
import { ShareIcon, usePlatform } from "@/components/ShareIcon";

/**
 * Share what you are looking at.
 *
 * Two shapes, because two places need it. A stock page wants the whole block:
 * the card shown full width with buttons under it, since the card is the thing
 * being offered. A chart wants one quiet button beside its own controls, since
 * the chart is already on screen and the button is an afterthought.
 *
 * Both run the same three-step fallback, because support is uneven and a share
 * button that fails silently is worse than none. What travels on a timeline is
 * a picture rather than a link, so the first thing tried is handing the
 * operating system the rendered PNG: phones take it and open the share sheet
 * with the image attached, which is one tap from looking to posting. Failing
 * that it shares the link, and failing that, which is most desktops, it copies
 * the link and says so.
 *
 * A share the person cancels is not an error. AbortError is swallowed on
 * purpose, otherwise backing out of the sheet flashes a failure at them.
 */

type Common = { text: string; title?: string };
/** The full block: card image, then actions. Used on a stock page. */
type BlockProps = Common & { url: string; card: string };
/** One button, for a chart that is already on screen. */
type InlineProps = Common & { image: string; anchor: string };

function isInline(p: BlockProps | InlineProps): p is InlineProps {
  return "image" in p;
}

async function shareIt(
  { img, url, title, text }: { img: string; url: string; title: string; text: string },
  say: (m: string) => void,
) {
  try {
    const nav = navigator as Navigator & {
      canShare?: (d: ShareData) => boolean;
      share?: (d: ShareData) => Promise<void>;
    };

    if (nav.share && nav.canShare) {
      try {
        const res = await fetch(img);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], "stonkpile.png", { type: "image/png" });
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title, text, url });
            return;
          }
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        // fall through to a link share rather than giving up
      }
    }

    if (nav.share) {
      await nav.share({ title, text, url });
      return;
    }

    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    say("Copied");
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    say("Could not share");
  }
}

export function Share(props: BlockProps | InlineProps) {
  const [note, setNote] = useState<string | null>(null);
  const platform = usePlatform();
  const say = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(null), 2200);
  };

  if (isInline(props)) {
    const { image, anchor, text, title } = props;
    const go = () =>
      shareIt(
        {
          img: image,
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}/#${anchor}`
              : `https://stonkpile.xyz/#${anchor}`,
          title: title ?? "Stonkpile",
          text,
        },
        say,
      );

    return (
      <span className="share">
        <button type="button" className="share-btn" onClick={go}>
          <ShareIcon platform={platform} /> Share
        </button>
        <a
          className="share-png"
          href={image}
          download="stonkpile.png"
          target="_blank"
          rel="noopener noreferrer"
        >
          PNG
        </a>
        {note && <span className="share-note">{note}</span>}
      </span>
    );
  }

  const { url, card, text, title } = props;
  const go = () => shareIt({ img: card, url, title: title ?? "Stonkpile", text }, say);
  const tweet =
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}` +
    `&url=${encodeURIComponent(url)}`;

  return (
    <div className="sharewrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sharecard" src={card} alt="" />
      <div className="shareactions">
        <button type="button" className="btn primary" onClick={go}>
          <ShareIcon platform={platform} size={14} /> Share
        </button>
        <a className="btn" href={tweet} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <a className="btn" href={card} download="stonkpile.png" target="_blank" rel="noopener noreferrer">
          Download PNG
        </a>
        {note && <span className="share-note">{note}</span>}
      </div>
    </div>
  );
}
