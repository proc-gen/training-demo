"use client";

import { clock, num, pace } from "@/lib/data/format";
import type { Planned, PlannedSet } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { Row2 } from "@/lib/ux/primitives/Row2";
import { Table } from "@/lib/ux/primitives/Table";

/** What the plan ASKED FOR: target pace, heart-rate ceiling, and structure.
 *
 * It renders for a run that has not happened -- where it is the only thing there
 * is to show -- and behind the `Planned` tab of one that has, so the athlete can
 * get back to the prescription after the fact.
 *
 * IT SHOWS NO MEASUREMENT AND MUST NOT LEARN HOW. Every number here comes from
 * the manifest and the week's pace chart; nothing is read off an activity. That
 * is what lets the same component describe Friday's session on Tuesday.
 *
 * THE REFERENCE/CRITERION DISTINCTION IS THE POINT OF THE BAND ROW. A recovery,
 * easy or long run is scored on HEART RATE -- the pace band is what the plan
 * intends, not what it judges -- and `band_is_reference` is the grader's own
 * statement of which it is. Rendering the band without saying so would read as a
 * criterion, and a reader who believes an easy run is pace-scored will go and
 * "fix" a run that was executed correctly. A sub-T set's band is not marked,
 * because its reps genuinely are prescribed at it.
 */
export function PlannedReadout({ planned }: { planned: Planned }) {
  const sets = planned.sets ?? [];
  const reference = planned.band_is_reference === true;

  return (
    <div>
      <Table raw headers={[{ label: "Planned" }, { label: "" }]}>
        {planned.prescribed ? (
          <Row2 k="Prescribed" v={planned.prescribed} />
        ) : null}
        {planned.target_display || planned.band_display ? (
          <Row2
            k={
              reference
                ? "Reference pace"
                : planned.target_display
                  ? "Target"
                  : "Target pace"
            }
            /* A run with ONE set states its target here; a `mixed` run keeps
               null and its two sets each state their own, for the same reason
               `criterion` does. `Target` rather than `Target pace` when the
               value leads with a time, because it is not only a pace. */
            v={planned.target_display || planned.band_display || "--"}
          />
        ) : null}
        {planned.ceiling ? (
          <Row2
            k={planned.criterion === "hr" ? "Heart-rate ceiling" : "Criterion"}
            v={planned.ceiling}
          />
        ) : null}
        {planned.prescribed_seconds !== null &&
        planned.prescribed_seconds !== undefined ? (
          <Row2
            k="Duration"
            v={
              Array.isArray(planned.prescribed_seconds)
                ? planned.prescribed_seconds.map((s: number) => clock(s)).join("–")
                : clock(planned.prescribed_seconds)
            }
          />
        ) : null}
      </Table>

      {sets.length ? (
        <Table
          raw
          headers={[
            { label: "Set" },
            { label: "Reps", num: true },
            { label: "Each", num: true },
            { label: "Recovery", num: true },
            { label: "Target" },
            { label: "Criterion" },
          ]}
        >
          {sets.map((s: PlannedSet, i: number) => (
            <tr key={i}>
              <td>{s.mode || "set"}</td>
              {/* A RANGE MUST NEVER PRINT AS ONE NUMBER -- `8-10x600m` is a real
                  prescription, and showing it as `8` states a requirement the
                  plan did not make. A GROUPED set prints `3 × 3`, because
                  `3x3x200m` is three sets of three and `9` loses the shape the
                  session is actually run in. */}
              <td className="num">{repsText(s)}</td>
              {/* The prescription's OWN unit. `12x600m` is metres and `2x10:00`
                  is a clock; converting either into the other states the session
                  in terms nobody prescribed it in. */}
              <td className="num">{repLength(s)}</td>
              <td className="num">{floatLength(s)}</td>
              {/* `target_display` FIRST. A distance-prescribed rep is run to a
                  CLOCK -- `12x600m` is `2:27–2:32`, and a per-mile pace is not
                  a number anybody can act on 600 m into a rep. Composed in
                  Python beside the band it comes from, so the page carries no
                  second formatter of a target. */}
              <td>{s.target_display || s.band_display || bandPair(s) || "--"}</td>
              <td>{s.ceiling || "--"}</td>
            </tr>
          ))}
        </Table>
      ) : null}

      {reference ? (
        <Note>
          The pace band is a reference, not the criterion. This run is scored on
          time at or below its heart-rate ceiling — running it slower than the
          band costs nothing, and running it faster is only a problem if heart
          rate goes with it.
        </Note>
      ) : null}

      {/* A PROVISIONAL CHART HAS TO SAY SO. The week's pace chart is normally
          snapshotted at week END and confirmed by the athlete; one authored
          EARLY, so an unrun week has targets at all, carries
          `confirmed_by_athlete: false`. Without this the reader cannot tell a
          settled target from one that may move before they run it. */}
      {planned.chart_confirmed === false ? (
        <Note>
          These paces come from a provisional chart for the week ending{" "}
          {planned.chart_week_ending || "--"}, not yet confirmed — they may move
          before the session is run.
        </Note>
      ) : null}

      {/* A CARRIED-FORWARD CHART HAS TO SAY SO, and it is a different question
          from `chart_confirmed === false` above -- both can be true at once.
          This chart IS confirmed; it just belongs to an earlier week, because a
          chart is confirmed as its week closes and this week has not been
          lived. Without the note a target drawn from a fortnight-old chart
          looks exactly like a current one, and fitness is the whole reason
          these move weekly. */}
      {planned.chart_is_carried_forward ? (
        <Note>
          No pace chart for this week yet — one is confirmed as each week closes.
          These targets are carried forward from the chart for the week ending{" "}
          {planned.chart_week_ending || "--"}, and will be re-cut when this
          week&apos;s own chart lands.
        </Note>
      ) : null}

      {/* Silence here would leave a session showing a criterion and no target,
          which reads as a grader that failed rather than as a chart nobody has
          authored. */}
      {!planned.band_display && !sets.some((s: PlannedSet) => s.band_display) ? (
        <Note>
          No pace chart for this week, so no target pace could be resolved. The
          heart-rate criterion above is unaffected — it comes from the athlete
          thresholds, not from the chart.
        </Note>
      ) : null}
    </div>
  );
}

/** A prescribed duration that may be a RANGE, as `2:00–3:00`.
 *
 * `2-3 min walking recovery` is a real prescription and printing `2:00` states
 * a requirement the plan did not make -- the same rule the REPS column has held
 * for `8-10x600m` since it was written.
 */
export function clockRange(v: number | number[] | null | undefined): string {
  if (v === null || v === undefined) return "--";
  if (!Array.isArray(v)) return clock(v);
  const parts = v.map((x) => clock(x));
  return parts[0] === parts[parts.length - 1]
    ? parts[0]
    : `${parts[0]}–${parts[parts.length - 1]}`;
}

/** One rep's prescribed length, in the unit the plan stated it in. */
export function repLength(s: {
  rep_seconds?: number | number[] | null;
  rep_distance_m?: number | number[] | null;
}): string {
  if (s.rep_seconds !== null && s.rep_seconds !== undefined) {
    return clockRange(s.rep_seconds);
  }
  const d = s.rep_distance_m;
  if (Array.isArray(d)) return d.map((x) => `${x}m`).join(", ");
  if (d !== null && d !== undefined) return `${d}m`;
  return "--";
}

/** The recovery, and what it IS.
 *
 * A WALK IS LABELLED. It prices zero in both graders because both denominate in
 * running, and a reader shown `2:00–3:00` with no other word reads it as a jog
 * and wonders why the ceiling did not move.
 *
 * A GROUPED SET STATES ITS SECOND RECOVERY TOO. `3x3x200m w/ 200m jog between
 * reps and 400m between sets` has two, and the between-set one was expressible
 * nowhere until 2026-08-13 -- so the column showed `200m` and the page silently
 * described a shorter session than the plan.
 */
export function floatLength(s: {
  float_seconds?: number | number[] | null;
  float_distance_m?: number | null;
  float_mode?: string | null;
  groups?: number | null;
  group_float_seconds?: number | number[] | null;
  group_float_distance_m?: number | null;
}): string {
  let out = "--";
  if (s.float_seconds !== null && s.float_seconds !== undefined) {
    out = clockRange(s.float_seconds);
  } else if (s.float_distance_m !== null && s.float_distance_m !== undefined) {
    out = `${s.float_distance_m}m`;
  }
  if (out !== "--" && s.float_mode) out = `${out} ${s.float_mode}`;
  const between = groupFloat(s);
  return between ? `${out} (${between} between sets)` : out;
}

function groupFloat(s: {
  group_float_seconds?: number | number[] | null;
  group_float_distance_m?: number | null;
}): string | null {
  if (s.group_float_seconds !== null && s.group_float_seconds !== undefined) {
    return clockRange(s.group_float_seconds);
  }
  const d = s.group_float_distance_m;
  return d === null || d === undefined ? null : `${d}m`;
}

/** `3 × 3` for a grouped set, `9` for a flat one, `8–10` for a range.
 *
 * `reps` is the TOTAL and `reps_per_group` is derived from it in Python -- so
 * the two numbers here cannot disagree with the one the grader counted against.
 */
export function repsText(s: {
  reps?: number | number[] | null;
  groups?: number | null;
  reps_per_group?: number | number[] | null;
}): string {
  const flat = Array.isArray(s.reps) ? s.reps.join("–") : num(s.reps, 0);
  if (!s.groups || s.reps_per_group === null || s.reps_per_group === undefined) {
    return flat;
  }
  const per = Array.isArray(s.reps_per_group)
    ? s.reps_per_group.join("–")
    : String(s.reps_per_group);
  return `${s.groups} × ${per}`;
}

/** A pace-scored set has no band NAME to look up, so the grader emits the pair
 *  directly -- see `RepSet.band_sec_per_mi`. Exactly one of the two routes is
 *  ever set per set, so this only runs where `band_display` is absent. */
function bandPair(s: { band_sec_per_mi?: number[] | null }): string | null {
  const p = s.band_sec_per_mi;
  if (!p || p.length !== 2) return null;
  return `${pace(Math.min(...p))}-${pace(Math.max(...p))}/mi`;
}
