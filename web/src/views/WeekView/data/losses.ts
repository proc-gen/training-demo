/* Where each score's points went.
 *
 * The five bars were decoration: `Easy discipline 78` with nothing on the card
 * saying which run, which day or which check cost the 22. Every figure needed to
 * answer that was already published per run and per day; it was just never
 * shown.
 *
 * NOTHING HERE RE-DERIVES A SCORE, which is the same rule `format.ts` and
 * `facts.ts` carry. These functions sort, subtract and count published numbers.
 * The one thing they must never do is decide, for instance, which runs are
 * "easy" -- that is a scoring rule, it lives in `roll_up()`, and each result
 * carries the `score_bucket` it stamped. A page that partitioned runs itself
 * would eventually disagree with the score printed above it.
 */

import type { LoadDay, RepSet, RunResult, Week } from "@/lib/data/payload";
import { clock, dayName, num, pct, shortDate } from "@/lib/data/format";
import type { Ledger, Loss } from "@/lib/run/LossRow";

const EMPTY: Ledger = { rows: [], total: null, note: null };

/** The summation row. `pct` is the component's own score. */
function totalRow(
  label: string,
  why: string,
  pct: number | null | undefined,
  cost: string | null = null,
): Loss {
  return { key: "total", label, why, cost, pct: pct ?? null, total: true };
}

/** "Sun 8/9" for an ISO date, or the raw string when there is none. */
function when(date: string | null | undefined): string {
  return date ? `${dayName(date)} ${shortDate(date)}` : "--";
}

/** `total - earned`, or null when either is missing.
 *
 * `0.0` is falsy and is also the best possible outcome, so every guard here is
 * an explicit null test. Filtering on truthiness is what once hid every run that
 * landed exactly on its prescription.
 */
function shortfall(r: { earned?: number | null; total?: number | null }): number | null {
  if (r.earned === null || r.earned === undefined) return null;
  if (r.total === null || r.total === undefined) return null;
  return r.total - r.earned;
}

/* ------------------------------------------------------- easy and workout */

/** The runs that fed one category, worst shortfall first.
 *
 * `score_bucket` is stamped by `roll_up()` where the split is made. Reading the
 * role instead would mean copying CONTINUOUS_ROLES and QUALITY_ROLES into this
 * file, where they would drift.
 */
export function runsIn(week: Week, bucket: string): RunResult[] {
  const rows = (week.adherence?.results ?? []).filter(
    (r) => (r as { score_bucket?: string | null }).score_bucket === bucket,
  );
  return [...rows].sort((a, b) => (shortfall(b) ?? 0) - (shortfall(a) ?? 0));
}

/** The summation row for a seconds-ratio component.
 *
 * `n` is what is being counted -- runs, sessions -- because a total that says
 * only "Total" leaves the reader to work out what the denominator was over.
 */
function ratioTotal(
  s: { earned?: number | null; total?: number | null; pct?: number | null } | null | undefined,
  n: number,
  noun: string,
): Loss | null {
  if (!s || s.total === null || s.total === undefined) return null;
  return totalRow(
    `${n} ${noun}${n === 1 ? "" : "s"}`,
    `${clock(s.earned)} earned of ${clock(s.total)} judged`,
    s.pct,
    `${clock((s.total ?? 0) - (s.earned ?? 0))} lost`,
  );
}

/** Why a continuous run lost what it lost: the two published factors.
 *
 * `pct = hr_pct x duration_factor`, and the two mean different things -- one is
 * "how much of it was run at the right effort", the other "was it the length it
 * was meant to be". A single percentage cannot tell those apart, and they call
 * for opposite responses.
 */
function easyWhy(r: RunResult): string {
  const bits: string[] = [];
  if (r.hr_pct !== null && r.hr_pct !== undefined)
    bits.push(`${pct(r.hr_pct, 0)} of it at or below the ${r.planned?.ceiling ?? "--"} ceiling`);
  if (r.hr_avg !== null && r.hr_avg !== undefined) bits.push(`${r.hr_avg} avg`);
  const f = r.duration_factor;
  if (f !== null && f !== undefined && f !== 1) {
    const d = r.duration?.pct;
    bits.push(
      `credit ×${f.toFixed(2)}` +
        (d === null || d === undefined ? "" : ` (${pct(d, 1)} off the prescription)`),
    );
  }
  return bits.join(" · ") || "no heart-rate detail published";
}

function easyLedger(week: Week): Ledger {
  const runs = runsIn(week, "easy");
  const lost = runs.filter((r) => (shortfall(r) ?? 0) > 0);
  const clean = runs.length - lost.length;
  return {
    total: ratioTotal(week.adherence?.scores?.easy, runs.length, "run"),
    rows: lost.map((r) => ({
      key: String(r.id ?? r.date),
      label: `${when(r.date)} · ${r.role ?? "--"}`,
      why: easyWhy(r),
      cost: `${clock(shortfall(r))} lost`,
      pct: r.pct ?? null,
    })),
    note: clean
      ? `${clean} run${clean === 1 ? "" : "s"} scored full credit and are not listed.`
      : runs.length
        ? null
        : "No continuous run was scored this week.",
  };
}

/** Reps this set judged and failed. `ok === null` is NOT JUDGEABLE -- no heart
 *  rate, or a suspect split -- and is not a failure. */
function repsFailed(s: RepSet): number {
  return (s.rep_rows ?? []).filter((x) => x.work && x.ok === false).length;
}

function setWhy(s: RepSet): string {
  const bits: string[] = [];
  const want = Array.isArray(s.prescribed_reps)
    ? s.prescribed_reps.join("/")
    : s.prescribed_reps;
  if (s.detected_reps !== null && s.detected_reps !== undefined)
    bits.push(
      `${s.detected_reps} rep${s.detected_reps === 1 ? "" : "s"} detected` +
        (want === null || want === undefined ? "" : ` of ${want} prescribed`),
    );
  if (s.band_display) bits.push(`band ${s.band_display}`);
  const bad = repsFailed(s);
  if (bad) bits.push(`${bad} rep${bad === 1 ? "" : "s"} outside it`);
  return bits.join(" · ") || "no set detail published";
}

function workoutLedger(week: Week): Ledger {
  const runs = runsIn(week, "workout");
  const rows: Loss[] = [];
  for (const r of runs) {
    rows.push({
      key: String(r.id ?? r.date),
      label: `${when(r.date)} · ${r.prescribed || r.role || "--"}`,
      why:
        (shortfall(r) ?? 0) > 0
          ? `${clock(shortfall(r))} of ${clock(r.total)} judged work not earned`
          : "every judged second earned",
      cost: (shortfall(r) ?? 0) > 0 ? `${clock(shortfall(r))} lost` : null,
      pct: r.pct ?? null,
    });
    for (const [i, s] of (r.detail?.sets ?? []).entries())
      rows.push({
        key: `${r.id ?? r.date}-set-${i}`,
        label: s.mode ?? "set",
        why: setWhy(s),
        cost: null,
        pct: s.pct ?? null,
        depth: 1,
      });
  }
  return {
    total: ratioTotal(week.adherence?.scores?.workout, runs.length, "session"),
    rows,
    note: runs.length ? null : "No quality session was scored this week.",
  };
}

/* ------------------------------------------------------------- structure */

/** Failures first, then the checks that did not apply, then the passes.
 *
 * The not-applicable ones sit in the middle rather than last on purpose: they
 * are the reason the denominator is what it is, and a reader checking a score
 * of 75 needs to see that one of four checks left the sum entirely.
 */
export function structureRows(week: Week): Loss[] {
  const s = week.adherence?.structure;
  const checks = s?.checks ?? {};
  const why = s?.why ?? {};
  const rank = (v: boolean | null) => (v === false ? 0 : v === null ? 1 : 2);
  return Object.keys(checks)
    .sort((a, b) => rank(checks[a]) - rank(checks[b]) || a.localeCompare(b))
    .map((k) => ({
      key: k,
      label: k.replace(/_/g, " "),
      why: why[k] ?? "",
      cost: null,
      pct: null,
      verdict: checks[k],
    }));
}

function structureLedger(week: Week): Ledger {
  const s = week.adherence?.structure;
  const checks = s?.checks ?? {};
  const vals = Object.values(checks);
  const applicable = vals.filter((v) => v !== null);
  const na = vals.length - applicable.length;
  return {
    total: totalRow(
      `${vals.length} check${vals.length === 1 ? "" : "s"}`,
      applicable.length
        ? `${applicable.filter(Boolean).length} of ${applicable.length} applicable checks passed`
        : "no check applied to this week",
      s?.pct,
    ),
    rows: structureRows(week),
    note: na
      ? `${na} check${na === 1 ? "" : "s"} did not apply and left the denominator ` +
        `rather than passing for free.`
      : null,
  };
}

/* -------------------------------------------------------- load integrity */

function dayWhy(d: LoadDay): string {
  const bits = [
    `${num(d.se)} SE against a ${num(d.ceiling)} ceiling` +
      (d.ceiling_source ? ` (${d.ceiling_source})` : ""),
  ];
  if (d.run_se !== null && d.run_se !== undefined)
    bits.push(`${num(d.run_se)} running + ${num(d.nonrun_se)} background`);
  return bits.join(" · ");
}

/** A day over its ceiling and a day nobody could price are different findings.
 *
 * The second is not a failure -- it left both sides of the ratio -- so it must
 * never render as one, and it must not be dropped either: an unpriced day is the
 * page's own to-do list.
 */
function integrityLedger(week: Week): Ledger {
  const days = week.load?.days ?? [];
  const integrity = week.load?.integrity as
    | { earned?: number; total?: number; scored_days?: number; excluded?: string[] }
    | undefined;
  const over = days
    .filter((d) => d.scored && (d.pct ?? 100) < 100)
    .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100));
  const unpriced = days.filter((d) => !d.scored);
  const rows: Loss[] = [
    ...over.map((d) => ({
      key: d.date,
      label: `${when(d.date)} · ${d.role ?? "unstated"}`,
      why: dayWhy(d),
      cost: `${num((d.se ?? 0) - (d.ceiling ?? 0))} SE over`,
      pct: d.pct ?? null,
    })),
    ...unpriced.map((d) => ({
      key: d.date,
      label: `${when(d.date)} · ${d.role ?? "unstated"}`,
      why:
        d.ceiling === null || d.ceiling === undefined
          ? "the plan did not state a duration for every run on this date, so " +
            "the day was reported and left both sides of the ratio"
          : `step data is ${d.completeness ?? "incomplete"}, so the day left both ` +
            "sides of the ratio rather than being counted as a zero",
      cost: null,
      pct: null,
      verdict: null as boolean | null,
    })),
  ];
  const scored = integrity?.scored_days ?? days.filter((d) => d.scored).length;
  return {
    total: totalRow(
      `${scored} scored day${scored === 1 ? "" : "s"}`,
      `${num(integrity?.earned)} of ${num(integrity?.total)} SE inside a ceiling`,
      (integrity as { pct?: number } | undefined)?.pct,
      over.length
        ? `${num((integrity?.total ?? 0) - (integrity?.earned ?? 0))} SE over`
        : null,
    ),
    rows,
    note: over.length
      ? null
      : scored
        ? "No scored day exceeded its ceiling."
        : "No day in this week could be scored.",
  };
}

/* ------------------------------------------------------------ readiness */

/** One row per CHECK, not per day.
 *
 * Twenty-one cells is a grid nobody reads; "sleep failed on five of seven days"
 * is the finding. The dates are named so it stays checkable against the day
 * table below.
 */
export function readinessRows(week: Week): Loss[] {
  const perDay = week.load?.readiness?.per_day ?? [];
  const names = [...new Set(perDay.flatMap((d) => Object.keys(d.checks ?? {})))];
  const failedOn = (name: string) =>
    perDay.filter((d) => d.checks?.[name] === false).map((d) => d.date);
  // Worst first, then alphabetical, so the order is stable across weeks and the
  // finding is the first thing read.
  names.sort(
    (a, b) => failedOn(b).length - failedOn(a).length || a.localeCompare(b),
  );
  return names.map((name) => {
    const failed = failedOn(name);
    const absent = perDay
      .filter((d) => d.checks?.[name] === null || d.checks?.[name] === undefined)
      .map((d) => d.date);
    const passed = perDay.filter((d) => d.checks?.[name] === true).length;
    const available = passed + failed.length;
    return {
      key: name,
      label: name.replace(/_/g, " "),
      why:
        (failed.length
          ? `failed on ${failed.map(shortDate).join(", ")}`
          : "passed every day it was measured") +
        (absent.length
          ? ` · not measured on ${absent.map(shortDate).join(", ")}, which shrank ` +
            "the denominator rather than failing"
          : ""),
      cost: available ? `${passed} of ${available}` : "not measured",
      pct: null,
      verdict: available ? failed.length === 0 : null,
    };
  });
}

function readinessLedger(week: Week): Ledger {
  const r = week.load?.readiness;
  const rows = readinessRows(week);
  const available = r?.available;
  return {
    total: totalRow(
      available === null || available === undefined
        ? "no checks"
        : `${available} check${available === 1 ? "" : "s"}`,
      available === null || available === undefined
        ? "no wellness check was available this week"
        : `${r?.passed} of ${available} checks passed`,
      r?.pct,
    ),
    rows,
    note:
      r?.hrv_baseline === null || r?.hrv_baseline === undefined
        ? null
        : `HRV is judged against a baseline of ${r.hrv_baseline}` +
          (r.hrv_baseline_source ? ` (${r.hrv_baseline_source}).` : "."),
  };
}

/* ------------------------------------------------------------------ entry */

/** The ledger for one component, or an empty one for a key nothing knows. */
export function ledger(week: Week, component: string): Ledger {
  switch (component) {
    case "easy":
      return easyLedger(week);
    case "workout":
      return workoutLedger(week);
    case "structure":
      return structureLedger(week);
    case "integrity":
      return integrityLedger(week);
    case "readiness":
      return readinessLedger(week);
    default:
      return EMPTY;
  }
}
