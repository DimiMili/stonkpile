/**
 * A venue or issuer mark.
 *
 * Every file under /public/brand was downloaded from that company's own domain.
 * None of them are drawn here and none are approximations: a logo that is nearly
 * right is worse than no logo, because the whole point of this site is telling
 * people what is genuine. Tessera's brand site is tessera.pe; tesseralab.co is
 * only the host serving their token metadata, which is why the earlier lookup
 * there came back empty. Anything not listed here still falls back to a lettered
 * tile rather than a guess at what a logo looks like.
 */
const MARKS: Record<string, { src: string; label: string }> = {
  Phoenix: { src: "/brand/phoenix.png", label: "Phoenix" },
  Hyperliquid: { src: "/brand/hyperliquid.png", label: "Hyperliquid" },
  xStocks: { src: "/brand/xstocks.png", label: "xStocks" },
  // Backpack, not Sunrise. On 2 Oct this read Sunrise and carried sunrise.xyz's
  // icon, on the reasoning that Sunrise is the brand the market sees. Backpack's
  // own documentation settles it the other way: Backpack Securities issues and
  // custodies, and Sunrise, a Wormhole Labs platform, coordinates the listing,
  // the liquidity and the distribution. In a column headed Issuer, the issuer is
  // Backpack. The verification underneath says so too: we read the metadata host
  // backpack.exchange and then printed a different company's name next to it.
  Backpack: { src: "/brand/backpack.png", label: "Backpack" },
  Ondo: { src: "/brand/ondo.svg", label: "Ondo" },
  PreStocks: { src: "/brand/prestocks.png", label: "PreStocks" },
  Tessera: { src: "/brand/tessera.png", label: "Tessera" },
  Securitize: { src: "/brand/securitize.png", label: "Securitize" },
  // Superstate has no usable mark on their own domain: the only thing served is
  // a 766-byte favicon, and the logos under assets.superstate.com belong to the
  // companies they list rather than to Superstate. So no entry, and the
  // component falls back to a lettered tile, which is the designed behaviour
  // and better than an approximation.
};

export function Brand({
  name,
  size = 20,
  label,
}: {
  name: string;
  size?: number;
  /** Show the name next to the mark. Off in dense tables, on in headings. */
  label?: boolean;
}) {
  const m = MARKS[name];
  const text = m?.label ?? name;
  return (
    <span className="brand" style={{ ["--mark" as string]: `${size}px` }}>
      {m ? (
        <img className="brand-mark" src={m.src} alt="" width={size} height={size} loading="lazy" />
      ) : (
        <span className="brand-mark brand-letter" aria-hidden="true">
          {text.slice(0, 1)}
        </span>
      )}
      {label && <span className="brand-name">{text}</span>}
      {!label && <span className="sr-only">{text}</span>}
    </span>
  );
}
