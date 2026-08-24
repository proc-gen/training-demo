"use client";

import type { SeriesSpec } from "../data/panels";

/** Which series a multi-series graph is showing.
 *
 * THIS ROW IS THE LEGEND, and there is deliberately no `<Legend>` beside it.
 * Every box carries its own series' swatch and name, so the key and the control
 * are one thing. Rendering both would put two swatches on screen for one meaning,
 * which is the duplication `Legend`'s own docstring warns about -- and the reader
 * would have to match a colour in one row against a word in another.
 *
 * IT IS ALSO THE ACCESSIBILITY RELIEF. Seven categorical hues cannot clear the
 * CVD separation gate at every pair, so colour is never the only channel: the
 * name sits beside the swatch here, the chart end-labels each line, and the
 * tooltip names every series. Unticking isolates any one of them outright, which
 * is the strongest disambiguation on offer.
 *
 * A real `<input type="checkbox">` rather than a styled button: it is a set of
 * independent toggles, which is exactly what a checkbox group is, and it comes
 * with keyboard and screen-reader behaviour nobody has to re-implement.
 */
export function SeriesPicker({
  series,
  enabled,
  onToggle,
}: {
  series: SeriesSpec[];
  enabled: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="series-picker" role="group" aria-label="Series">
      {series.map((s) => (
        <label className="series-item" key={s.key}>
          <input
            type="checkbox"
            checked={enabled.has(s.key)}
            autoComplete="off"
            onChange={() => onToggle(s.key)}
          />
          <span className="swatch" style={{ background: s.color }} />
          {s.label}
        </label>
      ))}
    </div>
  );
}
