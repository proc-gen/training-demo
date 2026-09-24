"use client";

import { num } from "@/lib/data/format";
import type { Week } from "@/lib/data/payload";

/** How every ceiling in the week was built, stated once rather than per row.
 *
 * A ceiling is a DERIVATION since 2026-08-08 -- what the day was prescribed to
 * cost -- where it used to be a lookup in a per-role table. A derivation nobody
 * can check is a number on trust, and both of its measured inputs can silently
 * be an assumption instead: the cadence falls back to a population default and
 * the background allowance falls back to a derivation over the trailing window.
 *
 * IT SITS BELOW THE TABLE AND CARRIES A BULLET PER CONSTANT, from 2026-08-15.
 * One muted line naming five numbers said what the formula was and nothing
 * about why any of them is what it is -- and the two that matter are exactly
 * the two that are measurements rather than method. `175 spm` is this athlete's
 * gait and `1,440 background` is a median over a stated window chosen so one
 * heavy day cannot license itself, and neither fact was anywhere on the page.
 */
export function CeilingFormula({ week }: { week: Week }) {
  const ci = week.load?.ceiling_inputs;
  if (!ci) return null;

  const measured = ci.cadence_source === "measured";
  const fromBaseline = ci.background_source === "baseline";

  // THE BACKGROUND TERM IS PER DAY AND THE MEDIAN IS PER WEEK, because the
  // budget converts at each day's own resting heart rate. One line cannot state
  // what any given day was allowed, so name the range the week actually used
  // and which side of the max won -- otherwise the `max(...)` above reads as
  // undecided and the day table's ceilings look unexplained.
  const used = (week.load?.days ?? [])
    .map((d) => d.ceiling_background_steps)
    .filter((v): v is number => v != null);
  const sides = [
    ...new Set(
      (week.load?.days ?? [])
        .map((d) => d.ceiling_background_source)
        .filter((v): v is string => v != null),
    ),
  ].sort();
  const lo = used.length ? Math.min(...used) : null;
  const hi = used.length ? Math.max(...used) : null;

  return (
    <section className="ceiling-note">
      {/* NO BUDGET MEANS NO `max`, not a `max` with a dash in it. The grader
          leaves the ceiling on the trailing median alone when the model states
          no budget, and a formula line reading `max(1,661 background, --)` is
          not the arithmetic that produced the numbers in the table above. */}
      <p>
        ceiling = prescribed run minutes × {num(ci.cadence_spm)} spm ×{" "}
        {ci.run_step_weight ?? "--"} × {ci.margin ?? "--"} +{" "}
        {ci.background_trimp_budget == null ? (
          <>{num(ci.background_steps)} background</>
        ) : (
          <>
            max({num(ci.background_steps)} background,{" "}
            {ci.background_trimp_budget} TRIMP of walking)
          </>
        )}
      </p>
      <ul>
        <li>
          <b>{num(ci.cadence_spm)} spm</b> —{" "}
          {measured ? (
            <>
              this athlete&rsquo;s <b>measured</b> running cadence, from the load
              baseline the week is graded against
              {ci.default_cadence_spm == null ? null : (
                <>
                  . Without one the model&rsquo;s population default of{" "}
                  {num(ci.default_cadence_spm)} spm stands in, and every
                  prescribed step count becomes an estimate rather than this
                  athlete&rsquo;s gait
                </>
              )}
              .
            </>
          ) : (
            <>
              the model&rsquo;s <b>population default</b> — no measured{" "}
              <code>cadence_spm</code> in the load baseline, so every prescribed
              step count below is an estimate rather than this athlete&rsquo;s
              gait.
            </>
          )}
        </li>
        <li>
          <b>{num(ci.background_steps)} background steps</b> — the{" "}
          <b>median</b> daily non-run step count over the{" "}
          {ci.background_window_days == null
            ? "trailing window"
            : `${ci.background_window_days} days`}{" "}
          <i>before</i> the week. Median rather than mean so a single outlier day
          cannot raise every later ceiling and license itself; before the week
          and never from it, so a uniformly heavy week cannot compare against its
          own middle.{" "}
          {fromBaseline
            ? "Confirmed in the load baseline."
            : `Derived here — ${ci.background_source || "source unstated"}.`}
        </li>
        {ci.background_trimp_budget == null ? null : (
          <li>
            <b>{ci.background_trimp_budget} TRIMP of walking</b> — a{" "}
            <b>floor</b> under that median, because a median is a <i>centre</i>:
            about half of ordinary days sit above it before anything unusual
            happens, which left a rest day almost no room for an errand. Stated
            as an impulse because that is what it is being weighed against — a
            light recovery run is worth roughly 30 TRIMP.
            {lo == null ? null : (
              <>
                {" "}
                This week it came to{" "}
                <b>
                  {lo === hi ? num(lo) : `${num(lo)}–${num(hi)}`} SE
                </b>
                , from the {sides.join(" and ")}.
              </>
            )}{" "}
            It converts at the {ci.walk_reference_spm ?? "reference"} spm
            reference walk and the day&rsquo;s own resting heart rate —{" "}
            <b>never</b> at how the day was actually walked, since a ceiling
            drawn from execution rises to meet the day.
          </li>
        )}
        <li>
          <b>× {ci.run_step_weight ?? "--"}</b> — a running step costs about
          two and a half walking ones. Running lands at roughly 2.5–3.0×
          bodyweight against walking&rsquo;s ~1.2×, even though a pedometer
          counts them the same.
        </li>
        <li>
          <b>× {ci.margin ?? "--"}</b> — the ceiling margin, the headroom a day
          gets over exactly what it was prescribed. It multiplies the{" "}
          <b>run term alone</b>: a percentage is the right shape for a
          prescribed duration, and the wrong shape for a background that varies
          by a roughly fixed number of steps however long the run was. Over the
          whole ceiling it gave a rest day 85 SE of slack against a long
          day&rsquo;s 2,082, for the same errand.
        </li>
      </ul>
    </section>
  );
}
