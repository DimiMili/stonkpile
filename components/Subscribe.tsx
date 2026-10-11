"use client";

import { useEffect, useRef } from "react";

/**
 * The weekly report block, where the Findings list used to be.
 *
 * The findings were four sentences of arithmetic sitting above the fold on a
 * page that a reviewer called half dashboard, half landing page. They belong in
 * something people subscribe to, not in the first screen of a product.
 *
 * The form is beehiiv's own embed rather than a form of ours posting to an API.
 * That is deliberate: the moment we store an email ourselves we take on a
 * controller's obligations, a privacy notice, deletion requests, a processor
 * agreement. Letting the provider collect it keeps all of that with them, and
 * the only thing on our side is this script tag and the sentence under it.
 *
 * Loaded on mount rather than in the document head so it costs nothing to
 * anyone who never scrolls this far.
 */
const FORM_ID = "e0b6d0d7-5f60-4ddb-9762-9678158f7129";
const LOADER = "https://subscribe-forms.beehiiv.com/v3/loader.js";

export function Subscribe() {
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = slot.current;
    /* React runs effects twice in development. Without this the loader is
       injected twice and renders two forms. */
    if (!host || host.querySelector("script")) return;
    const s = document.createElement("script");
    s.src = LOADER;
    s.async = true;
    s.dataset.beehiivForm = FORM_ID;
    host.appendChild(s);
  }, []);

  return (
    <section className="report" aria-label="The weekly report">
      <div className="report-say">
        <p className="report-k">The findings moved</p>
        <h2 className="report-t">Every finding now ships in the weekly report</h2>
        <p className="report-s">
          What changed in the category, which companies gained or lost a market, and what
          the record says. One email a week, built from the same index this page runs on.
        </p>
      </div>
      <div className="report-do">
        <div ref={slot} className="report-form" />
        <p className="report-fine">
          Your address is stored with our email provider and nowhere else. Unsubscribe in
          one click.
        </p>
      </div>
    </section>
  );
}
