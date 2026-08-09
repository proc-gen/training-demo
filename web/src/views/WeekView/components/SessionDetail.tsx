"use client";

import type { PaceChart, RepSet } from "@/lib/data/payload";
import { RepSetPanel } from "./RepSetPanel";

/** Every prescribed block inside one session.
 *
 * A session can carry more than one set -- an alternation is two, and a workout
 * inside a longer continuous run is one block among several.
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
        <RepSetPanel key={si} set={st} chart={chart} />
      ))}
    </div>
  );
}
