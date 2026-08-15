/* Why one run scored what it scored -- or why it is reported rather than scored.
 *
 * IT BRANCHES ON PUBLISHED FIELDS, NEVER ON A ROLE LIST. Every case below is
 * recognised by the presence of something the grader emitted: `hr_pct` means a
 * continuous run was scored, `detail.progression` means it was judged on getting
 * faster, `detail.unscorable` carries the grader's OWN sentence saying why it
 * was not scored at all. Keying on `role` would mean copying CONTINUOUS_ROLES,
 * QUALITY_ROLES and VOLUME_ROLES into TypeScript -- the drift `roll_up()`'s
 * `score_bucket` exists to prevent, one level down.
 *
 * NOTHING HERE RE-DERIVES A SCORE, the same rule `losses.ts` carries. It
 * multiplies two published factors to SHOW the arithmetic, and every other row
 * restates a number the grader already produced.
 *
 * EVERY GUARD IS AN EXPLICIT NULL TEST. `duration.pct === 0.0` means the run
 * landed exactly inside its prescription, which is the best possible outcome and
 * is falsy -- filtering on truthiness is what once hid every run that was bang
 * on, in the table this replaced.
 */

import { clock, pct } from "@/lib/data/format";
import type { RepSet, RunResult } from "@/lib/data/payload";
import type { Ledger, Loss } from "./losses";

/** A prescription, which is a RANGE as often as a scalar.
 *
 * `[1800, 1800]` collapses to one clock: the plan says "30 min", not
 * "30:00-30:00". Ported from the duration table this absorbed, where it mirrors
 * `fmt_prescribed` on the Python side.
 */
export function prescribedClock(
  v: number | number[] | null | undefined,
): string {
  if (v === null || v === undefined) return "--";
  if (!Array.isArray(v)) return clock(v);
  if (v.length === 2 && v[0] === v[1]) return clock(v[0]);
  return v.map(clock).join("–");
}

function row(
  key: string,
  label: string,
  why: string,
  opts: Partial<Loss> = {},
): Loss {
  return { key, label, why, cost: null, pct: null, ...opts };
}

/** The length row, from `duration`. Null when the run had no prescription --
 *  which holds it harmless rather than scoring it against a clock nobody set. */
function durationRow(r: RunResult): Loss | null {
  const d = r.duration;
  if (!d) return null;
  const f = r.duration_factor;
  const full = f === null || f === undefined || f >= 1;
  const bits = [`${clock(d.actual)} ran of ${prescribedClock(d.prescribed)}`];
  // 0.0 is the best outcome and MUST render.
  if (d.pct !== null && d.pct !== undefined)
    bits.push(`${d.pct > 0 ? "+" : ""}${d.pct.toFixed(1)}%`);
  if (d.reason) bits.push(d.reason);
  return row("duration", "Length", bits.join(" · "), {
    cost: full
      ? "full credit"
      : `credit ×${(f as number).toFixed(2)}`,
    verdict: full,
  });
}

/** The effort row for a scored continuous run. */
function effortRow(r: RunResult): Loss {
  const bits = [
    `${pct(r.hr_pct, 0)} of it at or below the ${r.ceiling ?? "--"} ceiling`,
  ];
  if (r.hr_avg !== null && r.hr_avg !== undefined)
    bits.push(`${r.hr_avg} avg / ${r.hr_max ?? "--"} max`);
  return row("effort", "Time at effort", bits.join(" · "), {
    pct: r.hr_pct ?? null,
  });
}

function setRow(s: RepSet, i: number): Loss {
  const bits: string[] = [];
  const want = Array.isArray(s.prescribed_reps)
    ? s.prescribed_reps.join("/")
    : s.prescribed_reps;
  if (s.detected_reps !== null && s.detected_reps !== undefined)
    bits.push(
      `${s.detected_reps} rep${s.detected_reps === 1 ? "" : "s"}` +
        (want === null || want === undefined ? "" : ` of ${want} prescribed`),
    );
  if (s.ceiling) bits.push(`against ${s.ceiling}`);
  const failed = (s.rep_rows ?? []).filter((x) => x.work && x.ok === false).length;
  if (failed) bits.push(`${failed} outside it`);
  if (s.unbanded_seconds)
    bits.push(`${clock(s.unbanded_seconds)} reported, not scored — no target pace`);
  // EVERY JUDGED REP MISSING ON ONE SIDE is a target mismatch, not an execution
  // failure. The grader works this out and it was thrown away until 2026-08-11.
  if (s.off_target)
    bits.push(
      `every judged rep was ${s.off_target === "fast" ? "faster" : "slower"} ` +
        "than the band — a target mismatch rather than an execution failure",
    );
  return row(`set-${i}`, s.mode ?? "set", bits.join(" · ") || "no set detail", {
    pct: s.pct ?? null,
    depth: 1,
  });
}

/** A run that is reported rather than scored, with the grader's own reason. */
function reported(r: RunResult, why: string): Ledger {
  const rows: Loss[] = [];
  const dur = durationRow(r);
  if (dur) rows.push(dur);
  return {
    rows,
    total: {
      key: "total",
      label: "Not scored",
      why,
      cost: null,
      pct: null,
      total: true,
    },
    note: null,
  };
}

/** The sentence for a `none (x)` ceiling, or null if it is not one of those. */
function unscoredReason(ceiling: string): string | null {
  if (ceiling === "none (race)")
    return (
      "Reported, never scored. A race graded against an easy-run ceiling scores " +
      "near zero for doing exactly what was intended."
    );
  if (ceiling === "none (neuromuscular)")
    return (
      "Reps of a few seconds: heart rate lags them entirely and no date pace " +
      "exists for the distance. Reported by design, not by a detection failure."
    );
  if (ceiling === "none (volume_only)")
    return (
      "A separately-recorded warmup or cooldown. Counted as mileage, and scored " +
      "as part of no session — its seconds belong to a workout graded in " +
      "another file, so scoring them here would grade the same work twice."
    );
  if (ceiling === "none (walk)" || ceiling === "none (cross)")
    return (
      "Pure mechanical load. It belongs to the Load tab and is not running " +
      "volume here."
    );
  if (ceiling.startsWith("uncalibrated ("))
    return (
      "This ceiling is not calibrated, so the run is reported rather than " +
      "scored. Never falling back to the next ceiling down is the point — this " +
      "kind of session is MEANT to run above the easy ceiling, and grading it " +
      "there would score correct execution near zero."
    );
  return null;
}

/** The whole explanation for one run. */
export function runWhy(r: RunResult): Ledger {
  const detail = r.detail;
  const rows: Loss[] = [];

  // --- reported, not scored. Checked FIRST so a run with no score never falls
  // through to an arithmetic row it has no numbers for.
  if (detail?.unscorable) return reported(r, detail.unscorable);
  const ceiling = r.ceiling ?? "";
  if (r.pct === null || r.pct === undefined) {
    const why = unscoredReason(ceiling);
    if (why) return reported(r, why);
  }

  // --- a race, which is reported but has a rich detail block of its own.
  if (detail?.race && (r.pct === null || r.pct === undefined))
    return reported(r, unscoredReason("none (race)") as string);

  // --- scored continuous
  if (r.hr_pct !== null && r.hr_pct !== undefined) {
    rows.push(effortRow(r));
    const dur = durationRow(r);
    if (dur) rows.push(dur);
  }

  // --- progression, judged on getting faster
  const prog = (detail as { progression?: unknown[]; monotonic?: boolean | null;
                            hr_rising?: boolean | null; pace_spread?: number | null;
                            segments_assumed?: number | null } | null | undefined);
  if (prog?.progression) {
    rows.push(
      row("monotonic", "Each segment faster than the last",
          prog.monotonic === null || prog.monotonic === undefined
            ? "not enough paced segments to judge"
            : prog.monotonic
              ? "yes, across every prescribed segment"
              : "no — at least one segment was slower than the one before it",
          { verdict: prog.monotonic ?? null }),
    );
    if (prog.pace_spread !== null && prog.pace_spread !== undefined)
      rows.push(
        row("spread", "Pace spread",
            `${Math.round(prog.pace_spread)} sec/mi from first segment to last`),
      );
    if (prog.segments_assumed)
      rows.push(
        row("assumed", "Segments",
            `the plan did not state a count, so it was cut into ` +
            `${prog.segments_assumed} equal slices`),
      );
    const dur = durationRow(r);
    if (dur) rows.push(dur);
  }

  // --- quality sets
  for (const [i, s] of (detail?.sets ?? []).entries()) rows.push(setRow(s, i));

  // --- session-level context a quality run carries
  if (detail?.recoveries)
    rows.push(
      row("recoveries", "Recoveries",
          `${detail.recoveries_failed ?? 0} of ${detail.recoveries} did not bring ` +
          "heart rate down enough" +
          (detail.recovery_failure_pct === null ||
           detail.recovery_failure_pct === undefined
            ? ""
            : ` (${pct(detail.recovery_failure_pct, 0)})`)),
    );

  const earned = r.earned;
  const total = r.total;
  const haveArithmetic =
    earned !== null && earned !== undefined && total !== null && total !== undefined;

  const lost = haveArithmetic ? (total as number) - (earned as number) : 0;
  let totalRow: Loss | null = haveArithmetic
    ? {
        key: "total",
        label: r.role ?? "run",
        why: `${clock(earned)} earned of ${clock(total)} judged`,
        cost: lost > 0 ? `${clock(lost)} lost` : null,
        pct: r.pct ?? null,
        total: true,
      }
    : null;

  // ONE ROW ABOUT SCORING, NOT TWO. A run with a single scoring contributor was
  // stating the same verdict twice: a sub-T session showed `subt · 100%` as a
  // contributor and `subt · 100%` again as the total, and an easy run showed
  // `Time at effort 93%` above `easy 93%`. The second row added the arithmetic
  // and nothing else, so the arithmetic joins the first one instead.
  //
  // Only when the two genuinely agree. A run whose one set scored differently
  // from the run -- an unbanded set, a duration factor -- keeps both rows,
  // because there the difference between them IS the information.
  const scored = rows.filter((x) => x.pct !== null && x.pct !== undefined);
  if (
    totalRow &&
    scored.length === 1 &&
    totalRow.pct !== null &&
    Math.round(scored[0].pct as number) === Math.round(totalRow.pct)
  ) {
    const only = scored[0];
    totalRow = {
      ...totalRow,
      label: only.label,
      why: `${only.why} · ${totalRow.why}`,
    };
    rows.splice(rows.indexOf(only), 1);
  }

  return {
    rows,
    total: totalRow,
    note:
      rows.length === 0 && !totalRow
        ? "The grader published no detail for this run."
        : null,
  };
}
