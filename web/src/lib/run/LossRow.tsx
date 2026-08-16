"use client";

import { severity } from "@/lib/data/format";
import { Verdict } from "@/lib/ux/primitives/Verdict";

/** One line of a score's ledger: what it was, why it cost, and what it cost.
 *
 * A row carries EITHER a percentage or a verdict, never both -- a structure
 * check has no score of its own and an unpriced day has no verdict to give. The
 * two are rendered in the same column so the ledger stays one shape.
 *
 * `pct === 0` is a real score and must print. Only `null` is "no score", which
 * is why every guard here is an explicit null test rather than a truthiness one.
 *
 * The SUMMATION row is the same component, deliberately: the whole point of
 * moving the arithmetic under the ledger is that the component's own score lands
 * in the same column as each contributor's. It differs only by a rule above it,
 * so it reads as a total rather than as one more run.
 *
 * THE SHAPE LIVES HERE, beside the component that renders it, which is the
 * pattern `RepChartPanel`/`ChartPoint` and `RepPaceChart`/`RepPoint` already
 * follow: props in, markup out, and the props are this file's to declare. It
 * moved out of `views/WeekView/data/losses.ts` when the run subtree came up to
 * `lib/run/` -- that module is week-scoped (structure checks, readiness, the
 * per-component ledger) and has no business being the shared home of a type two
 * views need. Both builders import it: `lib/run/data/runWhy.ts` for one run's
 * ledger and `views/WeekView/data/losses.ts` for a week component's.
 */
export type Loss = {
  /** Stable react key. */
  key: string;
  /** What it is -- a run, a day, a check. */
  label: string;
  /** Why it cost what it cost, out of published numbers only. */
  why: string;
  /** What it cost, already formatted, or null where the notion does not apply. */
  cost: string | null;
  /** This contributor's own score, 0-100, or null when it has none.
   *  0 IS A REAL VALUE and must render; only null means "no score". */
  pct: number | null;
  /** Pass / fail / not-applicable, where the contributor is a check. */
  verdict?: boolean | null;
  /** 1 for a row nested under the one above it (a set inside its run). */
  depth?: number;
  /** The summation row at the foot of the ledger, ruled off from the rest. */
  total?: boolean;
};

export type Ledger = {
  rows: Loss[];
  /** The arithmetic behind the bar, as the LAST row.
   *
   * It was a headline above the rows until 2026-08-10, which is not what it is:
   * `4:21:07 earned of 5:34:37 judged` is the sum of the seven lines under it.
   * At the foot it lands where a reader arrives after the detail, and the
   * component's own score sits in the same column as every contributor's.
   */
  total: Loss | null;
  /** What was left out of `rows` and why -- never a silent truncation.
   *  Rendered BELOW `total`, because it qualifies the denominator that row
   *  just stated. */
  note: string | null;
};

export function LossRow({ loss }: { loss: Loss }) {
  const hasPct = loss.pct !== null && loss.pct !== undefined;
  return (
    <div
      className={
        "loss" + (loss.depth ? " is-nested" : "") + (loss.total ? " is-total" : "")
      }
    >
      <span className="what">
        {loss.label}
        <div className="muted">{loss.why}</div>
      </span>
      {loss.cost ? <span className="cost">{loss.cost}</span> : <span className="cost" />}
      <span className="verdict">
        {hasPct ? (
          <b style={{ color: severity(loss.pct) }}>{Math.round(loss.pct as number)}%</b>
        ) : "verdict" in loss ? (
          <Verdict v={loss.verdict} />
        ) : null}
      </span>
    </div>
  );
}
