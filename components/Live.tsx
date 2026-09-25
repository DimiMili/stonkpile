"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Live indicator, and the thing that makes it honest.
 *
 * The index rebuilds at most every 5 minutes, but only when somebody asks for
 * it, so an open tab used to sit frozen forever. This shows the age of what you
 * are looking at and quietly re-fetches once it goes stale, using
 * router.refresh() rather than a reload so nobody loses their scroll position.
 *
 * It only refreshes while the tab is visible. No point burning function budget
 * on pages nobody is looking at.
 */
export function Live({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    const born = Date.parse(generatedAt);
    let refreshedFor = "";

    const tick = () => {
      const mins = Math.max(0, Math.floor((Date.now() - born) / 60_000));
      setAge(mins);
      if (mins >= 5 && document.visibilityState === "visible" && refreshedFor !== generatedAt) {
        refreshedFor = generatedAt;
        router.refresh();
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [generatedAt, router]);

  return (
    <span className="live" title="Rebuilds every 5 minutes. This page refreshes itself.">
      <span className="live-dot" aria-hidden="true" />
      live
      {age !== null && (
        <span className="live-age">
          {age === 0 ? "just now" : `${age}m ago`}
        </span>
      )}
    </span>
  );
}
