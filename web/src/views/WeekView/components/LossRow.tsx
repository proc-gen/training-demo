"use client";

import { severity } from "@/lib/data/format";
import { Verdict } from "@/lib/ux/primitives/Verdict";
import type { Loss } from "../data/losses";

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
 */
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
