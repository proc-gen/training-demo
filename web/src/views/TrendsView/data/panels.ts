/* The trend panels, decided as DATA rather than as markup.
 *
 * Every panel is one scale on one plot, and colour follows the domain rather
 * than the panel: blue is adherence, orange is load, green is wellness. Both
 * rules are easier to keep when the panels are a list you can read end to end.
 *
 * Pure, so the omission rules below are testable in the node project rather than
 * only through a rendered chart.
 *
 * NOTHING HERE READS `payload.history` ANY MORE (2026-08-15). It was the source
 * of two series -- weekly mileage and a weekly resting-heart-rate mean -- and it
 * is HAND-AUTHORED: its `weeks` block stopped at 2026-07-27 while the athlete
 * was running 8/3 and 8/10, so the volume chart simply ended a fortnight short
 * and said nothing about it. Both quantities are measured elsewhere and daily,
 * and where the two overlapped they agreed to the digit (42.17 / 36.94 / 46.31 /
 * 50.30) -- the same measurement stored twice, one copy of which nobody updates.
 * The file stays published and stays a record; it is no longer plotted.
 */

import { n, num } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { shortDate } from "@/lib/data/format";
import { hasRuns, weekKeys } from "@/lib/data/weeks";
import type { Point } from "@/lib/ux/charts/LineChart";
import { isIncomplete, isLived } from "./coverage";
import { type FitnessDay, fitnessSeries } from "./fitnessSeries";
import { CAT, paceSeries } from "./paceSeries";

/** A plotted point that still knows its own date.
 *
 * `label` is display -- "8/15", which two different years share -- so a window
 * cannot be applied to it. The ISO date rides along beside it and `range.ts`
 * filters on that. It never reaches `LineChart`: `lib/ux` takes `Point`, and an
 * extra property on the object is invisible to it, which is what keeps the
 * chart library ignorant of what a trend is.
 */
export type TrendPoint = Point & {
  date: string;
  /** For a MULTI-SERIES panel: this date's value for each series, by key.
   *  A plain number is a line; `{lo, hi}` is a band. */
  values?: Record<string, SeriesValue>;
  /** The effective VO2max the pace panels' whole point derives from.
   *
   * DISPLAY ONLY, for the tooltip. Deliberately its own field rather than being
   * packed into `value`: whether a point EXISTS must not depend on a provenance
   * figure that none of its series are drawn from. One early chart records this
   * nested under `source`, which is why it arrives through `chartVo2max()`. */
  vo2max?: number | null;
  /** Set on a point that RESTATES the newest pace chart under a later Sunday,
   *  naming the chart it restates -- see `carriedCharts` in `paceSeries.ts`.
   *
   * The flag is what the dedup rule demands of any restatement: it must be
   * SAID. It is also what `spanOf`, `plotted` and `pointsIn` key their carried
   * behaviour on -- a carried point is drawn but never anchors a window and
   * never counts as a measurement. */
  carried?: string;
};

/** One series' value on one date. */
export type SeriesValue = number | { lo: number; hi: number } | null;

/** A line or band in a multi-series panel. Colour is assigned by POSITION in the
 *  palette's own validated order and never by rank, so a checkbox that hides a
 *  series cannot repaint the ones left behind. */
export type SeriesSpec = { key: string; label: string; color: string };

/** One executed measurement drawn against a series, at its own date.
 *
 * NOT A POINT, and the distinction is why it is its own type. A `TrendPoint` is
 * a slot on the x axis: it defines where the series runs, it is what `spanOf`
 * anchors a window on, and it is what `n of N points` counts. A mark is a single
 * observation dropped onto a grid the points already decided -- a workout run
 * between two weekly pace charts. Letting one into `points` would let a session
 * drag the default window past the last chart and inflate the caption with
 * something the series never measured.
 *
 * A MARK EITHER NAMES A SERIES OR STANDS ALONE, and the two are different
 * contracts. A KEYED mark (a workout) carries no colour -- colour is assigned by
 * position in the palette, so a mark that carried its own could disagree with
 * the band it sits on the moment the group's series list changed -- and it is
 * hidden when its series is unticked. A STANDALONE mark (a race, per the
 * athlete's 2026-08-26 ruling that *"races don't go on lines"*) belongs to no
 * series, so it carries its own `color` and `name`, and series ticks cannot
 * touch it -- the marks toggle is what hides it.
 *
 * `detail` is already worded -- `"10 reps"`, `"4 reps · belt"`, `"3.09 mi"`. A
 * `data/` module holds plain logic and cannot build a tooltip node, so the
 * sentence is composed where the vocabulary is and the chart is handed a string.
 */
export type PanelMark = {
  date: string;
  /** The series this mark sits on, or absent for a standalone one. */
  key?: string;
  /** A standalone mark's own colour -- keyed marks wear their series'. */
  color?: string;
  /** A standalone mark's value-row label ("time", "pace") -- keyed marks use
   *  their series' label. */
  name?: string;
  /** The tooltip's noun. Absent reads as `"workout"`, so every mark that
   *  predates the field keeps its wording.
   *
   *  A CONTINUOUS RUN NAMES ITS OWN ROLE here, and that is load-bearing rather
   *  than decorative: a long run is drawn on the Easy series and in Easy's
   *  colour (the athlete's ruling), so the noun is the only channel that says
   *  which of the two it was. Colour is never the only channel. */
  kind?: "workout" | "race" | "easy" | "recovery" | "long";
  value: number;
  detail: string;
};

/** An alternative quantity for the same panel -- its own points, its own
 *  formatter, its own scale. Two modes are two measurements, not one series
 *  wearing two formatters, which is why each carries a full point set. */
export type PanelMode = {
  key: string;
  label: string;
  points: TrendPoint[];
  /** That quantity's own marks. One observation is TWO numbers across two modes
   *  -- a race is 1191 seconds in Times and 384 s/mi in min/mi -- which is
   *  exactly why a mode carries its own points. Set marks on EVERY mode or on
   *  none: `TrendPanel` falls back to `panel.marks`, and a mark in the wrong
   *  mode's unit would land on the wrong part of the scale silently. */
  marks?: PanelMark[];
  format: (v: number) => string;
};

/** A different SERIES SET for the same panel, on a scale of its own.
 *
 * NOT A MODE, AND THE DISTINCTION IS THE WHOLE REASON BOTH EXIST. A mode is the
 * same series measured a different way -- race times as clocks or as min/mi. A
 * group is a different set of series entirely, chosen so that only zones on a
 * comparable scale share an axis.
 *
 * The athlete's own instruction, 2026-08-24: the target-pace zones span 282 s/mi
 * end to end with two large empty gaps inside, so ticking them all squeezes the
 * sub-threshold ladder into a quarter of the plot -- *"this helps limit colors
 * and ranges of paces being far apart."*
 *
 * **`groups` AND `modes` ARE MUTUALLY EXCLUSIVE TODAY.** Nothing needs both, and
 * a panel carrying both would have two answers to "which points are drawn". If
 * one ever does, decide that precedence explicitly rather than letting the
 * lookup order decide it.
 */
export type PanelGroup = {
  key: string;
  label: string;
  series: SeriesSpec[];
  points: TrendPoint[];
  /** What was actually RUN against these zones. See `PanelMark`. */
  marks?: PanelMark[];
};

/** Whether a point carries anything a chart would draw.
 *
 * A MULTI-SERIES POINT IS DRAWN WHEN ANY OF ITS SERIES HAS A VALUE. It has no
 * single scalar to be, and the two shortcuts both misreport: anchoring on the
 * chart's VO2max makes a point's existence depend on a provenance field, and
 * nominating one "primary" distance picks a series arbitrarily. It must also stay
 * independent of which boxes are ticked -- reading the enabled set here would
 * mean unticking a series moved the shared date window.
 */
export function drawn(p: TrendPoint): boolean {
  if (p.values) {
    return Object.values(p.values).some((v) => v !== null && v !== undefined);
  }
  return p.value !== null;
}

/** How often this series has a value to plot.
 *
 * REQUIRED ON EVERY PANEL, deliberately: it is what `densify` walks to build the
 * x axis, and a weekly series stepped daily gets six empty slots between every
 * pair of points. A default would make that a silent mistake in whichever panel
 * somebody adds next.
 */
export type Cadence = "day" | "week";

export type Panel = {
  key: string;
  title: string;
  cadence: Cadence;
  points: TrendPoint[];
  /** Present on a MULTI-SERIES panel, and what makes it one. On a GROUPED panel
   *  it is the DEFAULT group's series, so the panel still declares one. */
  series?: SeriesSpec[];
  /** Alternative quantities the reader can switch between. `points` above is
   *  `modes[0].points` whenever this is set, so every window and count helper
   *  keeps working against the panel unchanged. */
  modes?: PanelMode[];
  /** Alternative SERIES SETS the reader can switch between -- see `PanelGroup`.
   *  `points` above is the DEFAULT group's points, for the same reason it is
   *  `modes[0].points`: `spanOf`, `plotted` and `defaultRange` read the panel
   *  and must keep answering without knowing what a group is. */
  groups?: PanelGroup[];
  /** Which group the panel opens on, by key.
   *
   *  EXPLICIT, because the alternative was reference identity -- seeding from
   *  whichever group whose `series` happened to be the same array object as the
   *  panel own. That works and fails SILENTLY the moment anything rebuilds the
   *  array, and what it fails to is `groups[0]`, so the dropdown would read one
   *  group while the plot drew another. `paceSeries` sets this and `points`
   *  above from the same group; a test asserts they agree. */
  defaultGroup?: string;
  /** The DEFAULT group's marks -- or the FIRST mode's, on a moded panel --
   *  mirrored here for the same reason `points` and `series` are: so anything
   *  reading the panel keeps working without knowing what a group or a mode is.
   *  See `PanelMark`. */
  marks?: PanelMark[];
  /** What the marks toggle calls them -- "Runs", "Races". `TrendPanel` defaults
   *  to "Workouts", so panels that predate the field keep their word.
   *
   *  PANEL-WIDE AND NOT PER GROUP. Target paces said "Workouts" until
   *  2026-08-26, which stopped being true the moment the Easy / recovery group
   *  grew dots that are not workouts; the athlete's choice was one word covering
   *  both rather than a label per group. */
  marksLabel?: string;
  color?: string;
  places?: number;
  zero?: boolean;
  reference?: number | null;
  seriesTitle: string;
  format: (v: number) => string;
};

/** Every panel with data behind it, in display order.
 *
 * A panel with no series is OMITTED rather than drawn empty: an empty plot
 * states that a measurement exists and is flat.
 *
 * THE WHOLE SERIES, ALWAYS -- the date window is applied above this, in
 * `range.ts`, which is what lets the windowed view state its own "n of N".
 *
 * A PANEL NO LONGER CARRIES A DESCRIPTION OR AN OMISSION SENTENCE. Both were
 * `sub`, the dimmed line under the title, and the athlete asked for it to go on
 * 2026-08-15 -- the third instruction of its kind, after grader warnings left
 * the page on 08-10 and caveats on 08-14. **The omissions themselves stand**: a
 * partly-covered week is still dropped from the total-load series and a day
 * whose CTL had not converged is still dropped from the fitness one. What is
 * gone is the page saying so, which means it has to be said in conversation
 * instead -- the athlete's own standing instruction about gaps and warnings.
 */
export function trendPanels(payload: Payload): Panel[] {
  const keys = weekKeys(payload);
  /* A WEEK THAT HAS NOT BEEN RUN LEAVES EVERY WEEK-KEYED SERIES. The plan
   * reaches two Mondays ahead, and those records are not empty -- `facts.miles`
   * is 0.0 and `facts.quality_share` is 0, which are good numbers and not
   * measurements. Plotted, they read as a collapse in training. See `hasRuns`.
   *
   * A WEEK THAT WAS LIVED AND HELD NO RUNNING IS A DIFFERENT THING, and joined
   * the series on 2026-08-21. Its `0.0` miles IS the measurement -- six such
   * weeks sit in the last year, five of them the March-April layoff -- and
   * dropping them drew the line straight across a month nobody ran a step.
   * `isLived` is what separates the two; a score of null still keeps its own
   * slot empty, because nothing scoreable came due. */
  const ran = keys.filter((k) => hasRuns(payload.weeks[k]) || isLived(payload.weeks[k]));
  /* The load half asks its own question of its own record: a week can carry
   * step data with no running in it at all, so the test is whether the grader
   * built any days -- not whether the athlete ran. */
  const loaded = keys.filter((k) => (payload.weeks[k]?.load?.days ?? []).length > 0);
  const panels: Panel[] = [];

  /* MEASURED, from each graded week's own facts. This was `history.json.weeks`
   * until 2026-08-15; see the module header for why it is not. */
  if (ran.length) {
    panels.push({
      key: "volume",
      title: "Weekly volume",
      cadence: "week",
      points: ran.map((k) => ({
        date: k,
        label: shortDate(k),
        value:
          (payload.weeks[k].adherence?.facts as { miles?: number })?.miles ?? null,
      })),
      seriesTitle: "miles",
      places: 1,
      zero: true,
      format: (v) => num(v, 1) + " mi",
    });

    panels.push({
      key: "adherence",
      title: "Adherence scores",
      cadence: "week",
      points: ran.map((k) => ({
        date: k,
        label: shortDate(k),
        value: payload.weeks[k].adherence?.scores?.week?.pct ?? null,
      })),
      seriesTitle: "overall",
      zero: true,
      format: (v) => Math.round(v) + "%",
    });

    /* NO REFERENCE LINE. It plotted `history.quality_share_window`, a frozen
     * hand-typed 0.0854 that was the `quality-share-drift` flag's baseline --
     * and that flag was deleted on 2026-08-10 for exactly that: a block of easy
     * running gives a low mean, so the first workout of any length departs from
     * it far enough to fire. Drawing the line without the verdict would keep
     * asserting a target nothing measured. The per-week series stays; it is
     * computed from each graded week. */
    panels.push({
      key: "quality",
      title: "Quality share of weekly time",
      cadence: "week",
      points: ran.map((k) => {
        const facts = (payload.weeks[k].adherence?.facts ?? {}) as {
          quality_share?: number;
          seconds?: number;
        };
        return {
          date: k,
          label: shortDate(k),
          /* A week that ran no seconds has NO SHARE, not a share of zero. The
           * grader publishes `quality_share: 0` there because 0/0 has to be
           * something, and plotted as 0% it reads as a week of nothing but easy
           * running rather than a week of no running at all. */
          value: facts.seconds ? (facts.quality_share ?? 0) * 100 : null,
        };
      }),
      seriesTitle: "quality",
      places: 1,
      zero: true,
      reference: null,
      format: (v) => num(v, 1) + "%",
    });
  }

  /* A week the step export only half covered sums FEWER DAYS, so plotting its
   * total beside a full week's compares different things -- the partial week
   * reads as a collapse in training. The load grader already names this
   * condition, so the flag is read rather than the coverage re-counted. */
  const whole = loaded.filter((k) => !isIncomplete(payload.weeks[k]));

  if (whole.length) {
    panels.push({
      key: "load",
      title: "Total load",
      cadence: "week",
      points: whole.map((k) => ({
        date: k,
        label: shortDate(k),
        value:
          (payload.weeks[k].load?.integrity as { total?: number })?.total ?? null,
      })),
      seriesTitle: "SE",
      zero: true,
      color: "var(--series-2)",
      format: (v) => num(v) + " SE",
    });
  }

  if (loaded.length) {
    panels.push({
      key: "acwr",
      title: "Acute:chronic, mechanical",
      cadence: "week",
      points: loaded.map((k) => ({
        date: k,
        label: shortDate(k),
        value: payload.weeks[k].load?.acwr_mech ?? null,
      })),
      seriesTitle: "A:C",
      places: 2,
      reference: 1.3,
      color: "var(--series-2)",
      format: (v) => num(v, 2),
    });
  }

  /* Fitness, fatigue and form. ONE PANEL SINCE 2026-08-27, the athlete's
   * instruction -- Daily TRIMP, CTL, TSB and ATL were four picker entries
   * showing four cuts of the same quantity family. This file used to say "form
   * gets its own axis: it is a difference and crosses zero", and the sharing is
   * legitimate anyway: every series here is in the TRIMP unit -- the impulse,
   * the two exponential averages of it, and their difference -- which is the
   * one-axis rule `MultiLineChart` states. The zero TSB crosses is the panel's
   * `reference`, carried over from the old Form panel.
   *
   * TRIMP IS A LINE NOW, the athlete's explicit choice over keeping bars
   * beside lines. `bgTrimp` rides along as its own toggleable series -- NEVER
   * merged into `trimp` (see `FitnessDay`), and its label is what says which
   * line is the uncalibrated walking estimate. A day with no background
   * measurement is an honest gap in that one line rather than the stack's
   * zero-height segment.
   *
   * COLOUR BY POSITION IN `CAT`, the multi-series rule -- the palette's own
   * validated order, never shuffled to taste. Slots 1 and 2 happen to land on
   * blue run / orange background, the same split `CalendarCell` and `LoadPanel`
   * encode.
   *
   * THE POINT SET IS THE UNION `fitnessSeries` already builds: every date any
   * of the five was priced, with per-series nulls where the rest were not.
   * CTL and TSB are withheld pre-convergence while TRIMP and ATL publish, so
   * those two lines simply start later on the same axis. */
  const fit = fitnessSeries(payload);
  if (fit.length) {
    const has = (k: keyof FitnessDay) => fit.some((d) => d[k] !== null);
    const series = [
      { key: "trimp", label: "TRIMP", field: "trimp" as const },
      { key: "bg", label: "background", field: "bgTrimp" as const },
      { key: "ctl", label: "Fitness", field: "ctl" as const },
      { key: "atl", label: "Fatigue", field: "atl" as const },
      { key: "tsb", label: "Form", field: "tsb" as const },
    ]
      .filter((s) => has(s.field))
      .map((s, i) => ({ key: s.key, label: s.label, color: CAT[i] }));
    panels.push({
      key: "fitness",
      title: "Fitness & fatigue",
      cadence: "day",
      series,
      points: fit.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: null,
        values: {
          trimp: d.trimp,
          bg: d.bgTrimp,
          ctl: d.ctl,
          atl: d.atl,
          tsb: d.tsb,
        },
      })),
      reference: 0,
      seriesTitle: "TRIMP",
      places: 1,
      format: (v) => num(v, 1),
    });
  }

  /* DAILY, from the day records. It was a weekly mean off `history.json` until
   * 2026-08-15, which was seven numbers ending 2026-08-03 against 76 measured
   * days ending 08-15. NO REFERENCE LINE: the athlete's
   * `wellness.resting_hr_baseline_band` is a published measurement, but the
   * readiness check is a one-sided rise and not a band test, so drawing an edge
   * of it would state a criterion nothing scores. */
  const rhr = (payload.days ?? []).filter((d) => n(d.resting_hr) !== null);
  if (rhr.length) {
    panels.push({
      key: "rhr",
      title: "Resting heart rate",
      cadence: "day",
      points: rhr.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: n(d.resting_hr),
      })),
      seriesTitle: "bpm",
      color: "var(--series-3)",
      format: (v) => num(v) + " bpm",
    });
  }

  const sleep = (payload.days ?? []).filter((d) => n(d.sleep_hours) !== null);
  if (sleep.length) {
    panels.push({
      key: "sleep",
      title: "Sleep",
      cadence: "day",
      points: sleep.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: n(d.sleep_hours),
      })),
      seriesTitle: "hours",
      places: 2,
      color: "var(--series-3)",
      reference: 7,
      format: (v) => num(v, 2) + " h",
    });
  }

  const hrv = (payload.days ?? []).filter((d) => n(d.hrv) !== null);
  if (hrv.length) {
    panels.push({
      key: "hrv",
      title: "HRV",
      cadence: "day",
      points: hrv.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: n(d.hrv),
      })),
      seriesTitle: "ms",
      color: "var(--series-3)",
      format: (v) => num(v) + " ms",
    });
  }

  /* LAST, and the only multi-series panels here. They answer a different
   * question from everything above -- not "what did the athlete do" but "what is
   * the athlete now capable of", which is the whole consequence of effective
   * VO2max moving and had never been drawn. */
  panels.push(...paceSeries(payload));

  return panels;
}
