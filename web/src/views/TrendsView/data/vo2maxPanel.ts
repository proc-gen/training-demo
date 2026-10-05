/* The effective-VO2max panel: the trailing window drawn at several lengths.
 *
 * THE ATHLETE ASKED FOR THIS, 2026-09-09: *"how difficult would it be to have a
 * graph of effective vo2max based on different time periods? for example, I
 * have it set to use 42 days, but the default calculation is 30 days"* -- and,
 * on hover, *"show projected times for each of the standard distances we have
 * in the card on the right side of the page."*
 *
 * Until then the curve existed only to price the race-times panel, and the
 * number itself reached the page as one tooltip row. This draws it.
 *
 * THREE WINDOWS, IN A FIXED ORDER: the athlete's configured window first, the
 * model's default second, a typed custom one LAST (fifth once the two subset
 * lines below are drawn). COLOUR IS BY POSITION in `CAT`, the multi-series
 * rule, and the order is fixed so that typing a custom window ADDS a line
 * without repainting the ones the reader has already learned. Duplicates collapse by value -- an athlete configured to 30 gets one
 * line, not two on top of each other -- and the custom slot simply does not
 * exist when the typed number is one already drawn.
 *
 * THE MODEL'S 30 IS A COMPARISON, NOT A FALLBACK. `windowDays()` still returns
 * null for an athlete stating no window and this panel is then not offered at
 * all; nothing here substitutes 30 for an unstated value. See
 * `DEFAULT_SHAPE_WINDOW_DAYS`.
 *
 * THE TOOLTIP PRICES EVERY WINDOW. Each distance row carries one time per drawn
 * line, in series order, so the reader can see how much the smoothing moves a
 * prediction -- the athlete's choice over pricing the configured window alone.
 * Always Daniels-Gilbert: the scored model, and the one every confirmed chart
 * is built from. The rail's model dropdown is not shared with this view.
 *
 * TWO MORE LINES, 2026-10-05: THE SAME TWO WINDOWS OVER WORKOUTS, LONG RUNS AND
 * RACES ONLY. The athlete wanted to see whether easy and recovery runs lift the
 * number, without making that the method -- `vo2maxSubset.ts` says which
 * activities count and why. They sit THIRD and FOURTH, after the two windows
 * they restate, so the original two keep their colours; a typed custom window
 * moves to fifth. Only the configured and default windows get one: the custom
 * box is a what-if on the smoothing, not on the selection.
 *
 * THE LINE THIS MAY NOT CROSS. Every number here is a PROJECTION. The window
 * values are what the confirmed charts anchor on, but a chart is confirmed and
 * this is computed; the target-paces panel stays on the confirmed chart for
 * that reason, and nothing graded is ever compared to a line drawn here.
 */

import { clock, num, shortDate } from "@/lib/data/format";
import { PACE_LABEL, RACE_ORDER } from "@/lib/data/paceRows";
import type { Payload } from "@/lib/data/payload";
import {
  DEFAULT_SHAPE_WINDOW_DAYS,
  RACE_DISTANCES,
} from "@/lib/pacemodels/constants";
import { modelRacePaces } from "@/lib/pacemodels/tables";
import { addDays } from "./dates";
import { CAT } from "./paceSeries";
import type { Panel, SeriesSpec, SeriesValue, TrendPoint } from "./panels";
import { type Sample, samples, shape, windowDays } from "./vo2maxCurve";
import {
  activityClasses,
  type SubsetSample,
  subsetSamples,
  subsetShape,
} from "./vo2maxSubset";

/** The longest window the text box accepts, in days.
 *
 * A YEAR, because a window is a smoothing and a smoothing longer than the
 * record's own seasons stops describing fitness on a date. It is also what
 * keeps a mistyped `4200` from asking for 4,200 shape() passes over the
 * series per render. Named so the input's own validation and the test read
 * the same number. */
export const MAX_WINDOW_DAYS = 365;

/** What the reader typed, as a window length, or null.
 *
 * A POSITIVE WHOLE NUMBER OF DAYS UP TO `MAX_WINDOW_DAYS`, and nothing else:
 * `3.5` days is not a window the Python `shape()` could be asked for, and a
 * null here CLEARS the custom line rather than drawing one at some coerced
 * length. Surrounding whitespace is forgiven because a text box invites it.
 */
export function parseWindow(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_WINDOW_DAYS ? n : null;
}

/** The window lengths drawn, in series order, duplicates collapsed. */
export function windowLengths(configured: number, custom: number | null): number[] {
  const out: number[] = [];
  for (const w of [configured, DEFAULT_SHAPE_WINDOW_DAYS, custom]) {
    if (w === null || !Number.isFinite(w) || w < 1) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/** A window's series key. The label is what the checkbox and tooltip say. */
export const windowKey = (days: number) => `w${days}`;
export const windowLabel = (days: number) => `${days} d`;

/** One drawn line: a window length, over every activity or the subset. */
export type Line = { days: number; subset: boolean };

/** Every activity, at each length -- the shape the panel had before the
 *  subset lines, and what a caller with no subset to draw passes. */
export const plainLines = (days: readonly number[]): Line[] =>
  days.map((d) => ({ days: d, subset: false }));

/** The subset line's key and label. No `·` in the label: the tooltip joins
 *  its column headers with one, and a label carrying it would read as two. */
export const subsetKey = (days: number) => `s${days}`;
export const subsetLabel = (days: number) => `${days} d (workouts + long)`;

export const lineKey = (l: Line) => (l.subset ? subsetKey(l.days) : windowKey(l.days));
export const lineLabel = (l: Line) => (l.subset ? subsetLabel(l.days) : windowLabel(l.days));

/** The lines drawn, in series order.
 *
 * The configured and default windows over everything, then the SAME two over
 * the subset, then a custom window -- so the first two never repaint, and a
 * custom window equal to one already drawn still collapses. `withSubset` false
 * (nothing classified) drops the subset lines rather than drawing two lines
 * that are null on every day.
 */
export function lineSpecs(
  configured: number,
  custom: number | null,
  withSubset: boolean,
): Line[] {
  const fixed = windowLengths(configured, null);
  const extra = windowLengths(configured, custom).filter((w) => !fixed.includes(w));
  return [
    ...plainLines(fixed),
    ...(withSubset ? fixed.map((d) => ({ days: d, subset: true })) : []),
    ...plainLines(extra),
  ];
}

/** The race keys the tooltip lists, in the rail's own reading order.
 *
 * `RACE_DISTANCES`' seven keys -- the rail's card shows the confirmed chart's
 * rows, and every chart the model proposes carries exactly these -- ordered
 * by `RACE_ORDER` with any key that list does not know APPENDED rather than
 * dropped, the `orderedKeys` rule restated for a number-valued record. */
export function projectedKeys(): string[] {
  const present = Object.keys(RACE_DISTANCES);
  const known = RACE_ORDER.filter((k) => present.includes(k));
  const rest = present.filter((k) => !RACE_ORDER.includes(k)).sort();
  return [...known, ...rest];
}

/** The tooltip's extra rows for one day: a header naming the column order,
 *  then one row per distance with a projected time per window.
 *
 * `--` FOR A WINDOW WITH NO VALUE THAT DAY, in its own column, so the columns
 * stay aligned with the header and a gap in one line reads as a gap rather
 * than shifting every later time one column left. And `--` again for a value
 * the model refuses (outside 20-90) -- never a neighbouring window's time. */
export function projectedRows(
  lines: readonly Line[],
  values: Readonly<Record<string, SeriesValue>>,
): { k: string; v: string }[] {
  const tables = lines.map((l) => {
    const v = values[lineKey(l)];
    return typeof v === "number" ? modelRacePaces("daniels_gilbert", v) : null;
  });
  const rows = [{ k: "Projected", v: lines.map(lineLabel).join(" · ") }];
  for (const key of projectedKeys()) {
    rows.push({
      k: PACE_LABEL[key] ?? key,
      v: tables
        .map((t) => {
          const s = t?.[key]?.seconds;
          return typeof s === "number" ? clock(s) : "--";
        })
        .join(" · "),
    });
  }
  return rows;
}

/** One point per calendar day the series spans, every window evaluated.
 *
 * THE SAME WALK AS `fitnessCurve`, once for all windows rather than once per
 * window: a day is OMITTED when no window holds anything -- the six-week gap
 * rule -- and within a kept day a window that holds nothing is `null`, which
 * the chart draws as a break in that one line. Never carried forward.
 *
 * `vo2max` is the CONFIGURED window's value, so `TrendPanel`'s existing note
 * row keeps stating the number the confirmed charts anchor on -- and states
 * nothing on a day that window is empty, rather than borrowing another's. */
export function windowPoints(
  sorted: readonly Sample[],
  lines: readonly Line[],
  configured: number,
  subset: readonly SubsetSample[] = [],
): TrendPoint[] {
  if (!sorted.length || !lines.length) return [];
  const out: TrendPoint[] = [];
  const last = sorted[sorted.length - 1].date;
  for (let d = sorted[0].date; d <= last; d = addDays(d, 1)) {
    const values: Record<string, SeriesValue> = {};
    let any = false;
    for (const l of lines) {
      const got = l.subset ? subsetShape(subset, d, l.days) : shape(sorted, d, l.days);
      values[lineKey(l)] = got ? got.value : null;
      if (got) any = true;
    }
    if (!any) continue;
    const own = values[windowKey(configured)];
    out.push({
      date: d,
      label: shortDate(d),
      value: null,
      values,
      vo2max: typeof own === "number" ? own : null,
      extra: () => projectedRows(lines, values),
    });
  }
  return out;
}

/** The panel, or null where there is nothing honest to draw.
 *
 * NULL WITHOUT A CONFIGURED WINDOW -- no fallback to the model's 30, the rule
 * `windowDays` states -- and null without samples, since an empty series would
 * be an empty plot claiming a flat measurement. `custom` is the typed window,
 * already validated by `parseWindow`; `TrendsView` calls this with it and
 * `trendPanels` with null. */
export function vo2maxPanel(payload: Payload, custom: number | null): Panel | null {
  const configured = windowDays(payload);
  if (configured === null) return null;
  const sorted = samples(payload.vo2max);
  if (!sorted.length) return null;

  const subset = subsetSamples(payload.vo2max, activityClasses(payload));
  const lines = lineSpecs(
    configured,
    custom,
    subset.some((s) => s.included === true),
  );
  const series: SeriesSpec[] = lines.slice(0, CAT.length).map((l, i) => ({
    key: lineKey(l),
    label: lineLabel(l),
    color: CAT[i],
  }));

  return {
    key: "vo2max",
    title: "Effective VO2max",
    cadence: "day",
    windowed: true,
    series,
    points: windowPoints(sorted, lines, configured, subset),
    seriesTitle: "VO2max",
    places: 2,
    format: (v) => num(v, 2),
  };
}
