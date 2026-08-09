"use client";

/** A swatch-and-label key for a chart.
 *
 * Every entry names a colour that MEANS something in the plot beside it. A
 * legend entry for a mark the chart draws its own label for is a second meaning
 * for one colour, which reads as two series.
 */
export function Legend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span className="legend-item" key={i}>
          <span className="swatch" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
