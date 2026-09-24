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
 *
 * IT LIVES IN `lib/run/` BECAUSE TWO VIEWS RENDER A RUN NOW. The Week tab's
 * runs table and the Calendar's day card show the same rows through the same
 * `RunRow`, and a view may not import a sibling view -- so the proximity rule
 * sent this whole subtree up to the shared container. Its content is unchanged
 * by the move.
 */

import { clock, num, pct } from "@/lib/data/format";
import type { RepSet, RunResult } from "@/lib/data/payload";
import type { Ledger, Loss } from "../LossRow";

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

/** `5.50` -> `5.50 mi`; `[5, 6]` -> `5.00–6.00 mi`. The mileage sibling of
 *  `prescribedClock`, with the unit stated once at the end. */
function prescribedMiles(v: number | number[] | null | undefined): string {
  if (v === null || v === undefined) return "--";
  if (!Array.isArray(v)) return `${num(v, 2)} mi`;
  if (v.length === 2 && v[0] === v[1]) return `${num(v[0], 2)} mi`;
  return `${v.map((m) => num(m, 2)).join("–")} mi`;
}

/** The length rows: one per unit the plan stated, so a run prescribed in both
 *  shows both.
 *
 *  EXACTLY ONE OF THEM CARRIES THE COST. A run states a duration or a distance
 *  and only one scores -- time wins where the plan states both -- and the
 *  grader marks the other with `factor: null`. So the unscored row reads
 *  *reported, not scored* rather than *full credit*: a deviation that was
 *  described and one that was forgiven are different things, and printing
 *  `full credit` on both would say the run was the length it was meant to be
 *  when it plainly was not.
 *
 *  Empty when the run had no prescription at all, which holds it harmless
 *  rather than scoring it against a clock nobody set. */
function lengthRows(r: RunResult): Loss[] {
  const f = r.duration_factor;
  const full = f === null || f === undefined || f >= 1;
  const one = (
    key: string,
    label: string,
    d: NonNullable<RunResult["duration"]>,
    stated: string,
  ): Loss => {
    const bits = [stated];
    // 0.0 is the best outcome and MUST render.
    if (d.pct !== null && d.pct !== undefined)
      bits.push(`${d.pct > 0 ? "+" : ""}${d.pct.toFixed(1)}%`);
    if (d.reason) bits.push(d.reason);
    const scored = d.factor !== null && d.factor !== undefined;
    return row(key, label, bits.join(" · "), {
      cost: !scored
        ? "reported, not scored"
        : full
          ? "full credit"
          : `credit ×${(f as number).toFixed(2)}`,
      verdict: scored ? full : null,
    });
  };

  const out: Loss[] = [];
  if (r.duration)
    out.push(one("duration", "Length", r.duration,
                 `${clock(r.duration.actual)} ran of ` +
                 prescribedClock(r.duration.prescribed)));
  if (r.distance)
    out.push(one("distance", "Distance", r.distance,
                 `${num(r.distance.actual, 2)} mi ran of ` +
                 prescribedMiles(r.distance.prescribed)));
  return out;
}

/** The effort row for a scored continuous run. */
function effortRow(r: RunResult): Loss {
  const bits = [
    `${pct(r.hr_pct, 0)} of it at or below the ${r.planned?.ceiling ?? "--"} ceiling`,
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

/** The sprint cadence verdict, or null where the grader asked no such question.
 *
 * COMPOSED HERE AND NOT STORED, the rule that took 509 of 510 load-flag
 * sentences out of the published tree: every word below comes from
 * `cadence_check`'s four fields, so the record carries the measurement and the
 * page carries the prose.
 *
 * `verdict: null` IS THE LOSS ROW'S "not a pass/fail" and is what
 * `not-evaluable` gets -- a verdict of `false` there would render a session the
 * criterion does not apply to as one that failed, which is the exact confusion
 * the gate exists to prevent. The two costs of getting it wrong are not
 * symmetric: a missed pass is a puzzle, a phantom failure is a session the
 * athlete would try to "fix".
 *
 * IT NEVER CARRIES A `pct`. The verdict scores nothing, and a percentage on this
 * row would put it in the same visual language as the rows that do.
 */
function cadenceRow(r: RunResult): Loss | null {
  const c = r.cadence_check;
  if (!c) return null;
  const peak = c.peak_spm;
  const line = c.target_spm;
  const measured =
    peak === null || peak === undefined
      ? "no cadence was recorded"
      : `cadence peaked at ${peak} spm`;
  if (c.verdict === "not-evaluable") {
    // WHICH nothing it is, from the fields rather than from a stored sentence.
    const because =
      peak === null || peak === undefined
        ? "the file carries no cadence samples"
        : c.rep_seconds === null || c.rep_seconds === undefined
          ? "this session prescribes no sprint-length reps, so the sprint " +
            "cadence line does not apply to it"
          : "the criterion is not stated";
    return row("cadence", "Sprint cadence", `${measured} — ${because}`, {
      verdict: null,
    });
  }
  const met = c.verdict === "met";
  return row(
    "cadence",
    "Sprint cadence",
    `${measured}${line === null || line === undefined ? "" :
      `, ${met ? "over" : "not over"} the ${line} spm line`}` +
      " — reported, and it moves no score",
    { verdict: met },
  );
}

/** A run that is reported rather than scored, with the grader's own reason. */
function reported(r: RunResult, why: string): Ledger {
  const rows: Loss[] = [];
  rows.push(...lengthRows(r));
  // THE PURE `neuromuscular` PATH. It has no score at all, so it returns from
  // here and never reaches the main assembly -- which is why this call and the
  // one in `runWhy` are both needed and neither is redundant. The other is for a
  // `mixed` run, which carries a sprint set AND a scored one.
  const cadence = cadenceRow(r);
  if (cadence) rows.push(cadence);
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

/** The sentence for a run the grader reports rather than scores, or null.
 *
 * IT USED TO MATCH THE CEILING STRING, and that was the defect this file's own
 * header warns about one level down. `unscoredReason("none (race)")` recovered
 * the ROLE by string-comparing a sentence Python composed for a human — so a
 * reworded label would have silently dropped every explanation, and the header
 * claim that this module "branches on published fields, never on a role list"
 * was untrue of its own longest function.
 *
 * The grader publishes `ceiling_kind` and `ceiling_role` beside the display
 * string since 2026-08-29, decided where the kind is KNOWN rather than parsed
 * back out of prose. This reads those.
 *
 * `REPORTED_REASON` IS KEYED ON THE ROLE AND MUST NOT BECOME A ROLE LIST: it
 * explains roles the grader has ALREADY said are unscored, and an unknown one
 * falls through to a generic sentence rather than to silence. That is the
 * `EMPHASIS_LABEL` / `FLAG_COMPONENT` precedent -- an unmapped token still
 * reaches the reader.
 */
const REPORTED_REASON: Record<string, string> = {
  race:
    "Reported, never scored. A race graded against an easy-run ceiling scores " +
    "near zero for doing exactly what was intended.",
  neuromuscular:
    "Reps of a few seconds: heart rate lags them entirely and no date pace " +
    "exists for the distance. Reported by design, not by a detection failure. " +
    "A sprint session does carry a cadence verdict, shown above — it reaches no " +
    "score either way.",
  volume_only:
    "A separately-recorded warmup or cooldown. Counted as mileage, and scored " +
    "as part of no session — its seconds belong to a workout graded in " +
    "another file, so scoring them here would grade the same work twice.",
  walk:
    "Pure mechanical load. It belongs to the Load tab and is not running " +
    "volume here.",
  cross:
    "Pure mechanical load. It belongs to the Load tab and is not running " +
    "volume here.",
};

const UNCALIBRATED_REASON =
  "This ceiling is not calibrated, so the run is reported rather than " +
  "scored. Never falling back to the next ceiling down is the point — this " +
  "kind of session is MEANT to run above the easy ceiling, and grading it " +
  "there would score correct execution near zero.";

export function unscoredReason(
  planned: { ceiling_kind?: string | null; ceiling_role?: string | null } | null
    | undefined,
): string | null {
  const kind = planned?.ceiling_kind;
  if (kind === "uncalibrated") return UNCALIBRATED_REASON;
  if (kind !== "none") return null;
  const role = planned?.ceiling_role ?? "";
  return (
    REPORTED_REASON[role] ??
    "The grader reports this session rather than scoring it: no criterion is " +
      "defined for it yet."
  );
}

/** The whole explanation for one run. */
export function runWhy(r: RunResult): Ledger {
  const detail = r.detail;
  const rows: Loss[] = [];

  // --- reported, not scored. Checked FIRST so a run with no score never falls
  // through to an arithmetic row it has no numbers for.
  if (detail?.unscorable) return reported(r, detail.unscorable);
  if (r.pct === null || r.pct === undefined) {
    const why = unscoredReason(r.planned);
    if (why) return reported(r, why);
  }

  // --- a race, which is reported but has a rich detail block of its own.
  if (detail?.race && (r.pct === null || r.pct === undefined))
    return reported(r, REPORTED_REASON.race);

  // --- scored continuous
  if (r.hr_pct !== null && r.hr_pct !== undefined) {
    rows.push(effortRow(r));
    rows.push(...lengthRows(r));
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
    rows.push(...lengthRows(r));
  }

  // --- quality sets
  for (const [i, s] of (detail?.sets ?? []).entries()) rows.push(setRow(s, i));

  // --- the sprint cadence verdict, for a run that DOES score. A `mixed` run
  // pairing 4x6s hill sprints with a sub-T block reaches here rather than
  // `reported`, and its sprints are judged on cadence while its block is judged
  // on heart rate. See the matching call inside `reported`.
  const cadence = cadenceRow(r);
  if (cadence) rows.push(cadence);

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
