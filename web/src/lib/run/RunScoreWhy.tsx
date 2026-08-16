"use client";

import type { RunResult } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { runWhy } from "./data/runWhy";
import { LossRow } from "./LossRow";

/** Why this run scored what it scored -- or why it is reported, not scored.
 *
 * Renders through `LossRow`, the same component the five score bars use, so the
 * page has ONE ledger shape: what contributed, what it cost, and the arithmetic
 * as the LAST row rather than a headline. A reader who has opened a score bar
 * already knows how to read this.
 *
 * The order matches `ScoreDetail`'s and for the same reasons: contributors,
 * then the sum, then the note that qualifies the denominator that sum just
 * stated. A ledger that lists only losses and says nothing about what it left
 * out reads as a complete account.
 */
export function RunScoreWhy({ run }: { run: RunResult }) {
  const l = runWhy(run);
  if (!l.rows.length && !l.total && !l.note) return null;
  return (
    <section className="run-why">
      {l.rows.length || l.total ? (
        <div className="losses">
          {l.rows.map((r) => (
            <LossRow key={r.key} loss={r} />
          ))}
          {l.total ? <LossRow loss={l.total} /> : null}
        </div>
      ) : null}
      {l.note ? <Note>{l.note}</Note> : null}
    </section>
  );
}
