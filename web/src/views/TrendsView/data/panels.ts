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
import { fitnessSeries } from "./fitnessSeries";
import { paceSeries } from "./paceSeries";

/** A plotted point that still knows its own date.
 *
 * `label` is display -- "8/15", which two different years share -- so a window
 * cannot be applied to it. The ISO date rides along beside it and `range.ts`
 * filters on that. It never reaches `LineChart`: `lib/ux` takes `Point`, and an
 * extra property on the object is invisible to it, which is what keeps the
 * chart library ignorant of what a trend is.
 *
 * `parts` is for a STACKED panel, where the plotted quantity has components a
 * reader needs separately -- run and background TRIMP. `value` still carries the
 * measurement the window counts and anchors on.
 */
export type TrendPoint = Point & {
  date: string;
  parts?: { value: number | null; color: string; label: string }[];
  /** For a MULTI-SERIES panel: this date's value for each series, by key.
   *
   * A plain number is a line. `{lo, hi}` is a band, and `mid` marks a real seam
   * inside one -- the target-paces panel draws Easy and Recovery as a single
   * region with the boundary between them ruled across it. */
  values?: Record<string, SeriesValue>;
  /** The effective VO2max the pace panels' whole point derives from.
   *
   * DISPLAY ONLY, for the tooltip. Deliberately its own field rather than being
   * packed into `value`: whether a point EXISTS must not depend on a provenance
   * figure that none of its series are drawn from. One early chart records this
   * nested under `source`, which is why it arrives through `chartVo2max()`. */
  vo2max?: number | null;
};

/** One series' value on one date. */
export type SeriesValue = number | { lo: number; hi: number; mid?: number } | null;

/** A line or band in a multi-series panel. Colour is assigned by POSITION in the
 *  palette's own validated order and never by rank, so a checkbox that hides a
 *  series cannot repaint the ones left behind. */
export type SeriesSpec = { key: string; label: string; color: string };

/** An alternative quantity for the same panel -- its own points, its own
 *  formatter, its own scale. Two modes are two measurements, not one series
 *  wearing two formatters, which is why each carries a full point set. */
export type PanelMode = {
  key: string;
  label: string;
  points: TrendPoint[];
  format: (v: number) => string;
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

/** The stacked total of a point, or null when a component was never measured.
 *
 * A TOTAL IS ONLY A TOTAL WHEN EVERY COMPONENT WAS MEASURED. Summing what is
 * present would publish a smaller number wearing the same name -- 2026-08-15
 * carries 32.99 of running impulse and no background reading at all, and a
 * "total" of 32.99 there would be a claim nobody made. `0` is a measurement and
 * sums normally; only `null` withholds.
 *
 * Pure and here rather than in the component, so the arithmetic is testable in
 * the node project.
 */
export function stackTotal(point: TrendPoint): number | null {
  const parts = point.parts ?? [];
  if (!parts.length || parts.some((p) => p.value === null)) return null;
  return parts.reduce((a, p) => a + (p.value ?? 0), 0);
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
  /** How to draw it. A per-day IMPULSE is a quantity per bucket, which is a bar;
   *  CTL, HRV and sleep are states sampled over time, which is a line. */
  kind?: "line" | "columns";
  cadence: Cadence;
  points: TrendPoint[];
  /** Present on a MULTI-SERIES panel, and what makes it one. */
  series?: SeriesSpec[];
  /** Alternative quantities the reader can switch between. `points` above is
   *  `modes[0].points` whenever this is set, so every window and count helper
   *  keeps working against the panel unchanged. */
  modes?: PanelMode[];
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

  // Fitness, fatigue and form. THE FIRST TIME THESE HAVE BEEN PLOTTED -- they
  // were five hand-read weekly points until 2026-08-11 and are a daily series
  // now. One series per panel and one axis, so form gets its own rather than
  // riding on fitness's scale: it is a difference and crosses zero.
  const fit = fitnessSeries(payload);

  /* DAILY IMPULSE, STACKED. The one panel that is bars rather than a line, and
   * the one that carries two components: a day's TRIMP is a quantity per bucket
   * where CTL and HRV are states sampled over time.
   *
   * THE COLOURS ARE THE CALENDAR'S AND THE LOAD TAB'S, not this view's domain
   * rule -- blue run, orange background. That split is already encoded twice
   * (`CalendarCell`, `LoadPanel`) for the identical distinction, and one meaning
   * per colour across the page beats one rule per view.
   *
   * `value` IS THE RUN TRIMP, which is the measured instrument: it is what the
   * window counts and anchors on. The bar's HEIGHT is the combined total, which
   * is what the athlete asked to see, and the tooltip states all three. A day
   * with no background measurement contributes no background height -- the same
   * `|| 0` `LoadPanel` uses -- rather than dropping a measured running day. */
  const impulse = fit.filter((d) => d.trimp !== null);
  if (impulse.length) {
    panels.push({
      key: "trimp",
      title: "Daily TRIMP",
      kind: "columns",
      cadence: "day",
      points: impulse.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: d.trimp,
        parts: [
          { value: d.trimp, color: "var(--series-1)", label: "run" },
          { value: d.bgTrimp, color: "var(--series-2)", label: "background" },
        ],
      })),
      seriesTitle: "TRIMP",
      places: 1,
      zero: true,
      format: (v) => num(v, 1),
    });
  }

  const covered = fit.filter((d) => d.ctl !== null);
  if (covered.length) {
    panels.push({
      key: "ctl",
      title: "Fitness (CTL)",
      cadence: "day",
      points: covered.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: d.ctl,
      })),
      seriesTitle: "CTL",
      color: "var(--series-2)",
      format: (v) => num(v),
    });
    panels.push({
      key: "tsb",
      title: "Form (TSB)",
      cadence: "day",
      points: covered.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: d.tsb,
      })),
      seriesTitle: "TSB",
      color: "var(--series-2)",
      reference: 0,
      format: (v) => num(v),
    });
  }

  const fatigue = fit.filter((d) => d.atl !== null);
  if (fatigue.length) {
    panels.push({
      key: "atl",
      title: "Fatigue (ATL)",
      cadence: "day",
      points: fatigue.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        value: d.atl,
      })),
      seriesTitle: "ATL",
      color: "var(--series-2)",
      format: (v) => num(v),
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
