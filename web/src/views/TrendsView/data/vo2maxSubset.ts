/* Effective VO2max over workouts, their warmups and cooldowns, long runs and
 * races only -- a COMPARISON line, never the method.
 *
 * THE ATHLETE ASKED FOR THIS, 2026-10-05, after a one-off calculation put the
 * 42-day value at 58.39 against the published 59.74: *"I'm wondering if easy
 * and recovery runs are bumping it up and giving us an unrealistic number"* --
 * and then, *"I don't want to make this the true method, at least not yet"*,
 * asking for it on the graph at both 42 and 30 days *"to see the data over
 * time and make a decision on it in the future."*
 *
 * SO NOTHING READS THESE LINES BUT THE CHART. The published anchor, every
 * confirmed pace chart and every graded number stay on the all-activity mean
 * in `vo2maxCurve.shape()`; this module adds a line beside it and changes no
 * value anywhere else.
 *
 * WHICH ACTIVITIES COUNT IS DECIDED BY PYTHON, NOT HERE. A run counts when the
 * grader stamped it with any `emphasis` -- `long`, `race` or `quality`, which
 * `P.session_emphasis()` derives from the ROLE and `is_long` and asserts
 * exhaustive over every role -- or when it is a `warmup` or `cooldown`, the
 * two support legs of a session, which carry no emphasis of their own. Reusing
 * `emphasis` is what keeps a copy of `QUALITY_ROLES` out of TypeScript: the
 * `score_bucket` rule, applied to a new question.
 *
 * HILL SPRINTS ARE EXCLUDED BY ROLE, at the athlete's instruction: *"for
 * workouts like the hill sprints prior to sub-t work, don't include the hill
 * sprints as part of this calculation."* `neuromuscular` IS in `quality`'s
 * emphasis, and its files are walking with seconds of sprinting -- their own
 * estimates read 21 and 25. `hill_repeats` is a different session (sustained
 * climbs, its own role) and is a workout, so it stays in.
 *
 * AN ACTIVITY NO WEEK NAMES IS UNKNOWN, NOT EXCLUDED. The record's first 181
 * estimates (2024-08 to 2024-12) predate the week manifests, so nothing says
 * what they were. A window holding ONE of them draws no value for the subset
 * line that day -- a mean over the part of a window that happens to be
 * classified would read as a measurement of the whole. So the line starts a
 * full window after the first manifest.
 */

import type { Payload, Vo2maxRow } from "@/lib/data/payload";

import { addDays } from "./dates";
import type { Sample, Shaped } from "./vo2maxCurve";
import { byDate, usableRow } from "./vo2maxCurve";

/** The two support-leg roles that count though they carry no emphasis. */
export const SUPPORT_ROLES: readonly string[] = ["warmup", "cooldown"];

/** The one role that is excluded though its emphasis is `quality`. */
export const EXCLUDED_ROLES: readonly string[] = ["neuromuscular"];

/** Whether one graded run belongs in the workouts-and-long-runs mean. */
export function counts(role: unknown, emphasis: unknown): boolean {
  if (typeof role === "string" && EXCLUDED_ROLES.includes(role)) return false;
  if (typeof role === "string" && SUPPORT_ROLES.includes(role)) return true;
  return Array.isArray(emphasis) && emphasis.length > 0;
}

/** Activity id → whether it counts, over every graded run of every week.
 *
 * KEYED BY THE ID AS A STRING, because `runalyze_id` arrives as a number or a
 * string and `activity_id` as a number; `String()` puts both on one footing.
 * A run with no `runalyze_id` is PLANNED and has no estimate to classify.
 * Should two rows ever name one activity, it counts if ANY of them says so --
 * the activity was that session, whatever else it also was.
 */
export function activityClasses(payload: Payload): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const week of Object.values(payload.weeks ?? {})) {
    const results = (week as { adherence?: { results?: unknown } } | null)
      ?.adherence?.results;
    if (!Array.isArray(results)) continue;
    for (const r of results as Record<string, unknown>[]) {
      const id = r?.runalyze_id;
      if (id === null || id === undefined || id === "") continue;
      const key = String(id);
      out.set(key, (out.get(key) ?? false) || counts(r.role, r.emphasis));
    }
  }
  return out;
}

/** A `Sample` with its class: true counts, false does not, null is unknown. */
export type SubsetSample = Sample & { included: boolean | null };

/** `samples()`, classified -- the SAME filter and the same stable order, so
 *  this line sums its activities in the order the plain line does. */
export function subsetSamples(
  rows: readonly Vo2maxRow[] | undefined,
  classes: ReadonlyMap<string, boolean>,
): SubsetSample[] {
  const out: SubsetSample[] = [];
  for (const r of rows ?? []) {
    if (!usableRow(r)) continue;
    const id = r.activity_id;
    const known =
      id === null || id === undefined ? undefined : classes.get(String(id));
    out.push({
      date: r.date,
      vo2max: r.vo2max as number,
      distanceKm: r.distance_km as number,
      included: known === undefined ? null : known,
    });
  }
  out.sort(byDate);
  return out;
}

/** `shape()` over the counted activities only, or null.
 *
 * The identical arithmetic -- inclusive window, `windowDays - 1` back, the
 * distance-weighted mean -- with two more ways to be null: an UNKNOWN activity
 * anywhere in the window (see the header), and a window holding nothing that
 * counts. Never a fallback to the plain line's value.
 */
export function subsetShape(
  samples: readonly SubsetSample[],
  asOf: string,
  windowDays: number,
): Shaped | null {
  const lo = addDays(asOf, -(windowDays - 1));
  let weighted = 0;
  let total = 0;
  let count = 0;
  for (const s of samples) {
    if (s.date < lo) continue;
    if (s.date > asOf) break;
    if (s.included === null) return null;
    if (!s.included) continue;
    weighted += s.vo2max * s.distanceKm;
    total += s.distanceKm;
    count++;
  }
  return total > 0 ? { value: weighted / total, count } : null;
}
