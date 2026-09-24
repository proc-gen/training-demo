"use client";

import { useState } from "react";

import { MAX_WINDOW_DAYS, parseWindow } from "../data/vo2maxPanel";

/** The custom window length for the effective-VO2max panel.
 *
 * A TEXT BOX, the athlete's own choice (2026-09-09) over a fixed ladder: the
 * two lines that are always drawn are the configured window and the model's
 * default, and this adds one more at whatever length the reader wants to
 * compare.
 *
 * COMMITS ON ENTER OR BLUR, NOT PER KEYSTROKE. A window is a whole number of
 * days and the panel is rebuilt from the payload each time it changes -- ~750
 * days of `shape()` per window -- so pricing `6`, then `60`, on the way to
 * `600` would draw two windows nobody asked for and refuse the third. The
 * typed text is this component's own state until committed; the committed
 * value is `TrendsView`'s, beside the aggregation, so it survives a graph
 * switch the way the aggregation does.
 *
 * AN INVALID ENTRY CLEARS. `parseWindow` returns null for anything that is not
 * a whole number of days in `1..MAX_WINDOW_DAYS`, and a null commit removes
 * the custom line rather than leaving a stale one under text that no longer
 * describes it. The box is normalised to what was committed (`" 60 "` reads
 * back `60`, an invalid entry reads back empty), so the text and the line
 * always agree.
 *
 * IT RENDERS ONLY WHERE THERE IS A CHOICE: `TrendPanel` mounts it only when
 * handed the committed value and a setter, which `TrendsView` does only for
 * the one `windowed` panel -- the `AggPicker` shape.
 */
export function WindowInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (days: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  const commit = () => {
    const parsed = parseWindow(text);
    setText(parsed === null ? "" : String(parsed));
    onCommit(parsed);
  };

  return (
    <label className="field window-input">
      <span>Custom window (days)</span>
      <input
        type="text"
        inputMode="numeric"
        className="window-days"
        value={text}
        placeholder={`1–${MAX_WINDOW_DAYS}`}
        autoComplete="off"
        aria-label="Custom window (days)"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}
