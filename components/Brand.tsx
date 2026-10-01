/**
 * A venue or issuer mark.
 *
 * Every file under /public/brand was downloaded from that company's own domain.
 * None of them are drawn here and none are approximations: a logo that is nearly
 * right is worse than no logo, because the whole point of this site is telling
 * people what is genuine. Tessera publishes no mark anywhere on tesseralab.co,
 * so it gets a lettered tile and is honestly the odd one out rather than a
 * guess at what their logo might look like.
 */
const MARKS: Record<string, { src: string; label: string }> = {
  Phoenix: { src: "/brand/phoenix.png", label: "Phoenix" },
  Hyperliquid: { src: "/brand/hyperliquid.png", label: "Hyperliquid" },
  xStocks: { src: "/brand/xstocks.png", label: "xStocks" },
  Backpack: { src: "/brand/backpack.png", label: "Sunrise" },
  Ondo: { src: "/brand/ondo.svg", label: "Ondo" },
  PreStocks: { src: "/brand/prestocks.png", label: "PreStocks" },
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
