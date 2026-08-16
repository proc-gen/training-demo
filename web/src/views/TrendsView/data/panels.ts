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
import { isIncomplete } from "./coverage";
import { fitnessSeries } from "./fitnessSeries";

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
};

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

export type Panel = {
  key: string;
  title: string;
  /** How to draw it. A per-day IMPULSE is a quantity per bucket, which is a bar;
   *  CTL, HRV and sleep are states sampled over time, which is a line. */
  kind?: "line" | "columns";
  points: TrendPoint[];
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
   * measurements. Plotted, they read as a collapse in training. See `hasRuns`. */
  const ran = keys.filter((k) => hasRuns(payload.weeks[k]));
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
      points: ran.map((k) => ({
        date: k,
        label: shortDate(k),
        value:
          ((payload.weeks[k].adherence?.facts as { quality_share?: number })
            ?.quality_share ?? 0) * 100,
      })),
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

  return panels;
}
