#!/usr/bin/env python3
"""
Ticker Wars pipeline v2
Universe : every tokenized stock on Solana, across all three issuers.
Pairs    : every coin quoted AGAINST one of them.
Prices   : Pyth 24/7 Equity.Index feeds.
All sources keyless and public.
"""
import json, time, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

UA = {"User-Agent": "tickerwars/0.2"}
JUP_VERIFIED = "https://lite-api.jup.ag/tokens/v2/tag?query=verified"
DEX_PAIRS = "https://api.dexscreener.com/token-pairs/v1/solana/{}"
PYTH_FEEDS = "https://hermes.pyth.network/v2/price_feeds?asset_type=equity"
PYTH_BENCH = "https://benchmarks.pyth.network/v1/price_feeds"

# issuer identified by metadata host - this is what separates the ~1,400 real
# tokens from lookalikes that merely put "xStock" in their name.
ISSUERS = {
    "xstocks-metadata.backed.fi": "xStocks",
    "backpack.exchange": "Backpack",
    "metadata.backpack.exchange": "Backpack",
    "cdn.ondo.finance": "Ondo",
}
# quoted assets that aren't memecoins
NOT_MEME = {"USDC", "USDT", "SOL", "WSOL", "CBBTC", "WBTC", "JLP", "XAUT0", "USDG",
            "PYUSD", "USDS", "JITOSOL", "MSOL", "BSOL", "WETH", "ETH", "USD1"}

LIQ_FLOOR = 5_000      # below this a stock token is listed, not traded
log = lambda m: print(m, file=sys.stderr, flush=True)


def get(url, retries=3, data=None):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA, data=data)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if i == retries - 1:
                log(f"  ! {url[:70]}: {e}")
                return None
            time.sleep(1.5 * (i + 1))


def num(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def underlying(sym, issuer):
    s = (sym or "").strip()
    if issuer == "xStocks" and s.endswith("x"):
        return s[:-1].upper()
    if issuer == "Ondo" and s.lower().endswith("on"):
        return s[:-2].upper()
    return s.upper()


# ---------- 1. universe ----------
def build_universe():
    toks = get(JUP_VERIFIED) or []
    uni = []
    for t in toks:
        host = urllib.parse.urlparse(t.get("icon") or "").netloc
        iss = ISSUERS.get(host)
        if not iss:
            continue
        s24 = t.get("stats24h") or {}
        uni.append({
            "mint": t["id"],
            "symbol": t.get("symbol", "?"),
            "name": t.get("name", ""),
            "icon": t.get("icon"),
            "issuer": iss,
            "underlying": underlying(t.get("symbol"), iss),
            "holders": t.get("holderCount") or 0,
            "price": num(t.get("usdPrice")),
            "liquidity": num(t.get("liquidity")),
            "volume24h": num(s24.get("buyVolume")) + num(s24.get("sellVolume")),
            "mcap": num(t.get("mcap")),
        })
    uni.sort(key=lambda t: t["volume24h"], reverse=True)
    return uni


# ---------- 2. pyth ----------
def pyth_layer(tickers):
    feeds = get(PYTH_FEEDS) or []
    idx = {}
    for f in feeds:
        a = f.get("attributes") or {}
        parts = (a.get("symbol") or "").split(".")
        if len(parts) < 3:
            continue
        tk = parts[2].split("/")[0]
        if tk not in tickers:
            continue
        kind = "always_on" if parts[1] == "Index" else "session"
        idx.setdefault(tk, {})[kind] = {"id": f.get("id"), "symbol": a.get("symbol")}

    # Hermes price updates now require auth (Pyth Pro). Market-hours state is
    # still public via benchmarks, and that is the piece the after-hours view needs.
    session = None
    probe = next((v.get("session", {}).get("id") for v in idx.values() if "session" in v), None)
    if probe:
        b = get(f"{PYTH_BENCH}/{probe}") or {}
        mh = b.get("market_hours") or {}
        if mh:
            session = {
                "isOpen": bool(mh.get("is_open")),
                "nextOpen": mh.get("next_open"),
                "nextClose": mh.get("next_close"),
            }
    return idx, session


# ---------- 3. pairs ----------
def scan_pairs(token, stock_mints):
    pairs = get(DEX_PAIRS.format(token["mint"])) or []
    quoted, own = [], []
    for p in pairs:
        b, q = p.get("baseToken") or {}, p.get("quoteToken") or {}
        rec = {
            "dex": p.get("dexId"),
            "url": p.get("url"),
            "pairAddress": p.get("pairAddress"),
            "liquidityUsd": num((p.get("liquidity") or {}).get("usd")),
            "volume24h": num((p.get("volume") or {}).get("h24")),
            "priceChange24h": num((p.get("priceChange") or {}).get("h24")),
            "createdAt": p.get("pairCreatedAt"),
        }
        if q.get("address") == token["mint"] and b.get("address") != token["mint"]:
            sym = (b.get("symbol") or "?")
            rec.update(coin=sym, coinMint=b.get("address"), coinName=b.get("name"),
                       isMeme=(sym.upper() not in NOT_MEME
                               and b.get("address") not in stock_mints))
            quoted.append(rec)
        elif b.get("address") == token["mint"]:
            rec["against"] = q.get("symbol") or "?"
            own.append(rec)
    quoted.sort(key=lambda r: r["volume24h"], reverse=True)
    return quoted, own


def main():
    log("universe ...")
    uni = build_universe()
    stock_mints = {t["mint"] for t in uni}
    by_issuer = {}
    for t in uni:
        by_issuer[t["issuer"]] = by_issuer.get(t["issuer"], 0) + 1
    log(f"  {len(uni)} tokenized stocks  {by_issuer}")

    liquid = [t for t in uni if t["liquidity"] >= LIQ_FLOOR]
    log(f"  {len(liquid)} above ${LIQ_FLOOR:,} liquidity -> scanning pairs")

    log("pyth ...")
    feeds, session = pyth_layer({t["underlying"] for t in liquid})
    log(f"  {len(feeds)} tickers matched, US market open: {session and session['isOpen']}")

    log("pairs ...")
    rows = []
    for i, t in enumerate(liquid, 1):
        quoted, own = scan_pairs(t, stock_mints)
        memes = [c for c in quoted if c["isMeme"]]
        f = feeds.get(t["underlying"], {})
        rows.append({
            **t,
            "has247Feed": "always_on" in f,
            "pythFeeds": f,
            "quotedCoins": memes,
            "quotedCount": len(memes),
            "quotedLiquidity": round(sum(c["liquidityUsd"] for c in memes), 2),
            "quotedVolume24h": round(sum(c["volume24h"] for c in memes), 2),
            "venues": sorted({p["dex"] for p in own if p["dex"]}),
        })
        if i % 10 == 0 or i == len(liquid):
            log(f"  [{i}/{len(liquid)}]")
        time.sleep(0.2)

    rows.sort(key=lambda r: r["quotedVolume24h"], reverse=True)
    all_coins = sorted(
        ({**c, "stock": r["symbol"], "underlying": r["underlying"], "issuer": r["issuer"]}
         for r in rows for c in r["quotedCoins"]),
        key=lambda c: c["volume24h"], reverse=True)

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "marketSession": session,
        "totals": {
            "universe": len(uni),
            "byIssuer": by_issuer,
            "tradeable": len(liquid),
            "universeVolume24h": round(sum(t["volume24h"] for t in uni)),
            "universeHolders": sum(t["holders"] for t in uni),
            "quotedCoins": len(all_coins),
            "quotedVolume24h": round(sum(c["volume24h"] for c in all_coins)),
            "quotedLiquidity": round(sum(c["liquidityUsd"] for c in all_coins)),
            "denominators": sum(1 for r in rows if r["quotedCount"]),
            "with247Feed": sum(1 for r in rows if r["has247Feed"]),
        },
        "stocks": rows,
        "coins": all_coins[:100],
    }
    json.dump(out, open("data.json", "w"), indent=1)
    T = out["totals"]
    log(f"\ndone. {T['universe']} stock tokens / {T['tradeable']} tradeable / "
        f"{T['quotedCoins']} coins quoted in stocks / ${T['quotedVolume24h']:,} 24h")


if __name__ == "__main__":
    main()
