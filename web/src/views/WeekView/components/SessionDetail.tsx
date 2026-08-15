"use client";

import type { PaceChart, RepSet } from "@/lib/data/payload";
import { RepSetPanel } from "./RepSetPanel";

/** Every prescribed block inside one session.
 *
 * A session can carry more than one set -- an alternation is two, and a workout
 * inside a longer continuous run is one block among several.
 *
 * `titled` IS FALSE FOR A LONE SET. The panel's heading names the mode, the
 * criterion and the score -- all three of which the explanation directly above
 * has just stated. With one set that is a third restatement of the same
 * verdict; with several it is the only thing telling the tables apart.
 */
export function SessionDetail({
  sets,
  chart,
}: {
  sets: RepSet[];
  chart: PaceChart | null | undefined;
}) {
  return (
    <div>
      {sets.map((st, si) => (
        <RepSetPanel key={si} set={st} chart={chart} titled={sets.length > 1} />
      ))}
    </div>
  );
}
