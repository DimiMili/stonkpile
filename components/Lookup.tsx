"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Copy } from "@/components/Copy";

export interface LookupItem {
  kind: "stock" | "coin";
  symbol: string;
  mint: string;
  underlying: string;
  name: string;
  issuer?: string;
  icon?: string;
  quotedCount: number;
  tradeable: boolean;
  stock?: string;
  volume24h?: number;
  platform?: string;
  lookalike?: string;
}

/** Solana mint addresses are base58 and 32-44 characters. Base58 drops 0, O, I
 *  and l precisely so an address cannot be mistyped into a different valid one,
 *  which is also what makes this test safe to use as "the user pasted a CA". */
const CA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

/**
 * Type a ticker or paste a contract address.
 *
 * Two changes over the first version, both from the same complaint: a ticker is
 * the one thing a fake token can copy exactly, and the board is full of coins
 * that were not searchable at all. So this now matches on mint address, and
 * searches coins alongside the stocks they are priced in.
 */
export function Lookup() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LookupItem[]>([]);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const raw = q.trim();
  const query = raw.toUpperCase();
  const isCA = CA.test(raw);
  /* Typing the project's own name is a trust question, not a search. */
  const selfQuery = /^\s*\$?stonk\s*pile\s*$|^\s*\$?stonkpile/i.test(raw);

  /* The table is fetched, not serialised into the page. Warm it the instant the
     input is touched, which on every input method happens before the first
     character arrives, so the list is usually already there. */
  const warm = useCallback(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/lookup")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { lookup: LookupItem[] }) => setItems(d.lookup ?? []))
      .catch(() => setFailed(true));
  }, []);

  const loading = items.length === 0 && !failed;

  const hits = useMemo(() => {
    if (!raw || !items.length) return [];

    // An address is exact or it is nothing. Case matters: base58 is case
    // sensitive, and a near-miss here must not be answered with a near-match.
    if (isCA) return items.filter((i) => i.mint === raw);

    return items
      .filter(
        (i) =>
          i.underlying.startsWith(query) ||
          i.symbol.toUpperCase().startsWith(query) ||
          (i.name && i.name.toUpperCase().includes(query)),
      )
      .sort((a, b) => {
        const exact = (i: LookupItem) =>
          i.underlying === query || i.symbol.toUpperCase() === query ? 0 : 1;
        // A ticker match beats a word buried in a name: typing STONK should not
        // put "Penny Stonks" above the coin actually called STONK.
        const pre = (i: LookupItem) =>
          i.underlying.startsWith(query) || i.symbol.toUpperCase().startsWith(query) ? 0 : 1;
        // stocks first: somebody typing AAPL wants the equity, not a coin that
        // happens to start with those letters
        const kindRank = (i: LookupItem) => (i.kind === "stock" ? 0 : 1);
        // A token wearing a real symbol goes straight under the real ones. It is
        // worth almost nothing in volume, which is exactly why volume must not
        // be what decides whether anyone sees it.
        const fake = (i: LookupItem) => (i.lookalike ? 0 : 1);
        return (
          exact(a) - exact(b) ||
          pre(a) - pre(b) ||
          kindRank(a) - kindRank(b) ||
          fake(a) - fake(b) ||
          (b.volume24h ?? 0) - (a.volume24h ?? 0) ||
          b.quotedCount - a.quotedCount
        );
      })
      .slice(0, 8);
  }, [items, raw, query, isCA]);

  return (
    <div className="lookup">
      <label className="lookup-label" htmlFor="ticker">
        Check a ticker or a contract address
      </label>
      {/* The box gets a visible frame and an icon. As an underlined serif line it
          read as a headline rather than something you type into, which is the
          single thing first readers said they missed. */}
      <div className="lookup-box">
        <svg className="lookup-mag" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="15.5" y1="15.5" x2="21" y2="21" />
        </svg>
      <input
        id="ticker"
        className="lookup-input"
        type="search"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="AAPL, NVDA, or paste a CA"
        value={q}
        onFocus={warm}
        onPointerEnter={warm}
        onChange={(e) => {
          warm();
          setQ(e.target.value);
        }}
      />
      </div>
      <p className="lookup-hint">
        Real or fake, has a market or not, and what is priced against it.
      </p>

      {/* Somewhere to start.
          A reader told us he opened the page and had no idea how to use it, and
          an empty box with a placeholder is the reason: it asks you to already
          know what you are looking for. These are one tap each, and they are
          chosen to teach rather than to demo. NVDA is the case everybody
          expects and gets right, SPCX is the one where three issuers price the
          same company differently, and OPENAI is a company with no public share
          price at all, so nothing can check what either issuer is charging.

          Deliberately not our own name: searching it returns the impostors that
          minted themselves against it, and a suggestion chip is an endorsement
          of the thing it leads to. */}
      {q.length === 0 && (
        <div className="lookup-eg">
          <span className="lookup-eg-k">Try</span>
          {["NVDA", "SPCX", "OPENAI"].map((t) => (
            <button
              key={t}
              type="button"
              className="lookup-chip"
              onClick={() => {
                warm();
                setQ(t);
                document.getElementById("ticker")?.focus();
              }}
            >
              {t}
            </button>
          ))}
          <span className="lookup-eg-or">or paste any contract address</span>
        </div>
      )}

      {raw.length > 0 && (
        <div className="lookup-results">
          {loading ? (
            <p className="lookup-loading">Loading the index…</p>
          ) : failed ? (
            <p className="lookup-empty">
              Could not load the index just now. Reload the page, or use{" "}
              <a href="/api/index?slim=1">the JSON</a>.
            </p>
          ) : selfQuery ? (
            /* On 29 Sep 2026, twenty tokens named STONKPILE were minted inside five
               minutes off the back of a repost. This site has no token, and the one
               place someone will check that is the box at the top of this page, so
               it has to answer for itself rather than shrug. */
            <p className="lookup-empty">
              <b>Stonkpile has no token.</b> There is no STONKPILE coin, no presale and
              no airdrop, and there never will be. Anything on-chain using this name was
              not minted by this project and is not affiliated with it. This index covers
              tokenized stocks and the coins priced against them, so a token like that
              does not appear in the results above either way.
            </p>
          ) : hits.length === 0 ? (
            <p className="lookup-empty">
              {isCA ? (
                <>
                  Nothing in this index has that mint address. It is not a tokenized stock
                  issued by one of the seven issuers this index verifies, and it is not a coin
                  quoted against one. Whatever it calls itself, it is something else.
                </>
              ) : (
                <>
                  No verified tokenized stock or quoted coin matches “{q}”. If you have found a
                  token using that name on-chain, it is not issued by xStocks, Backpack, Ondo,
                  PreStocks, Tessera, Securitize or Superstate.
                </>
              )}
            </p>
          ) : (
            hits.map((i) => <Hit key={i.mint} i={i} />)
          )}
        </div>
      )}
    </div>
  );
}

function Hit({ i }: { i: LookupItem }) {
  const coin = i.kind === "coin";
  // A coin lives on the page of the stock it is priced against; that page is
  // where its liquidity, turnover and pair age are shown.
  const href = coin ? `/s/${i.stock}` : `/s/${i.symbol}`;

  return (
    <a className={`hit${coin ? " hit-coin" : ""}${i.lookalike ? " hit-fake" : ""}`} href={href}>
      {i.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hit-icon" src={i.icon} alt="" width={26} height={26} loading="lazy" />
      ) : (
        <span className="hit-icon hit-icon-blank" aria-hidden="true" />
      )}
      <span className="hit-sym">{i.symbol}</span>
      <span className="hit-name">
        {i.lookalike
          ? `not the real ${i.lookalike}`
          : i.platform
          ? i.platform
          : i.name || (coin ? "coin" : "")}
      </span>
      <span className="hit-issuer">
        {i.lookalike ? "no issuer" : coin ? "coin" : i.issuer}
      </span>
      <span className="hit-state">
        {i.lookalike
          ? `a different token wearing that symbol`
          : coin
          ? `priced in ${i.stock}${i.quotedCount > 1 ? ` +${i.quotedCount - 1}` : ""}` +
            (i.volume24h ? ` · ${usd(i.volume24h)} 24h` : "")
          : !i.tradeable
          ? "listed, no market"
          : i.quotedCount > 0
          ? `${i.quotedCount} coins priced in it`
          : "has a market, nothing quoted in it"}
      </span>
      {/* The address someone actually needs, on the row that earned it. On an
          impostor the button says so, because the danger here is not that the
          address is hard to find, it is that the wrong one is easy to take. */}
      <span className="hit-ca">
        <Copy
          value={i.mint}
          label={i.lookalike ? "copy the impostor" : "copy address"}
          tone={i.lookalike ? "bad" : undefined}
        />
      </span>
    </a>
  );
}
