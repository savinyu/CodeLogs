import { encode } from "uqr";

/**
 * A QR code as server-rendered SVG. Always black on white, in both themes: some UPI apps can't
 * read an inverted code, so this is a deliberate exception to the theme tokens (like the OG image).
 */
export function UpiQr({ value, className }: { value: string; className?: string }) {
  const { size, data } = encode(value, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="UPI payment QR code"
      className={className}
    >
      <path d={path} className="fill-black" />
    </svg>
  );
}
