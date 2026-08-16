"use client";

import type { Week } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { ledger } from "../data/losses";
import type { ScoreComponent } from "../data/scoreComponents";
import { ComponentFlags } from "./ComponentFlags";
import { LossRow } from "@/lib/run/LossRow";

/** Why one score is what it is: the ledger, its total, the flags.
 *
 * Opened by clicking its bar. The order is deliberate -- what the ratio counts,
 * then what came out of it, then the sum, then what did not fit in `rows` and
 * why, then the flags that qualify the same number.
 *
 * THE ARITHMETIC IS THE LAST ROW, NOT A HEADLINE. It sat above the ledger until
 * 2026-08-10, where `4:21:07 earned of 5:34:37 judged` read as a title rather
 * than as what it is: the sum of the seven lines beneath it. At the foot it
 * lands where a reader arrives after the detail, and the component's own score
 * sits in the same column as every contributor's.
 *
 * `note` is never omitted when it exists, and it follows the total because it
 * qualifies the denominator that row just stated. A ledger that lists only the
 * losses and says nothing about the contributors it left out reads as a complete
 * account of the week, which is exactly the silent truncation this repo keeps
 * being bitten by.
 */
export function ScoreDetail({
  week,
  component,
  id,
}: {
  week: Week;
  component: ScoreComponent;
  id: string;
}) {
  const l = ledger(week, component.key);
  return (
    <section className="score-detail" id={id}>
      <h3>{component.label}</h3>
      <Note>{component.basis}</Note>

      {l.rows.length || l.total ? (
        <div className="losses">
          {l.rows.map((r) => (
            <LossRow key={r.key} loss={r} />
          ))}
          {l.total ? <LossRow loss={l.total} /> : null}
        </div>
      ) : null}

      {l.note ? <Note>{l.note}</Note> : null}

      <ComponentFlags week={week} component={component.key} />
    </section>
  );
}
