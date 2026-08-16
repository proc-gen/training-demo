"use client";

/** A swatch-and-label key for a chart.
 *
 * Every entry names a colour that MEANS something in the plot beside it. A
 * legend entry for a mark the chart draws its own label for is a second meaning
 * for one colour, which reads as two series.
 *
 * `outlined` IS FOR A SWATCH THAT IS NEARLY THE SURFACE. The calendar's session
 * tints are 22% washes, and an 11px chip of one is barely a colour without a
 * ring around it. Ringed, the chip is a miniature of the cell it stands for --
 * same fill, same `1px solid var(--border)`. PER ITEM and optional, so the four
 * other call sites are untouched; a saturated series colour needs no ring and
 * would only be boxed in by one.
 */
export function Legend({
  items,
}: {
  items: { color: string; label: string; outlined?: boolean }[];
}) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span className="legend-item" key={i}>
          <span
            className={"swatch" + (it.outlined ? " is-outlined" : "")}
            style={{ background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
