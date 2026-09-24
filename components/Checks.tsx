import type { Check } from "@/lib/checks";

/** The safety strip. Each row states what it found and what that means. */
export function Checks({ checks, title, note }: { checks: Check[]; title: string; note?: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {note && <p className="sec-note">{note}</p>}
      <div className="checks">
        {checks.map((c) => (
          <div className={`check ${c.level}`} key={c.id}>
            <div className="check-head">
              <span className="dotmark" aria-hidden="true" />
              <span className="check-label">{c.label}</span>
              <span className="check-value">{c.value}</span>
            </div>
            <p className="check-detail">{c.detail}</p>
          </div>
        ))}
      </div>
      <p className="disclaimer">
        These are arithmetic checks on public data, not advice. They tell you what the
        numbers look like, not what to do about them.
      </p>
    </section>
  );
}
