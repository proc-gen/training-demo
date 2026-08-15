"use client";

import type { Week } from "@/lib/data/payload";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { flagsFor } from "../data/flags";
import { FlagRow } from "./FlagRow";

/** The flags belonging to one score, inside that score's panel.
 *
 * These used to be a card at the bottom of the page, two screens below the bar
 * they qualify. `pace-creep` is a statement about easy discipline and
 * `sleep-debt` is a statement about readiness; reading either meant remembering
 * a number from earlier.
 *
 * THREE STATES, not two, and the distinction survives the move: `not-evaluable`
 * is "nobody looked" and must never read as `clear`. A component with no flags
 * at all says so rather than rendering nothing, because an empty space under a
 * score reads as "nothing fired".
 */
export function ComponentFlags({
  week,
  component,
}: {
  week: Week;
  component: string;
}) {
  const flags = flagsFor(week, component);
  return (
    <>
      <h4>Flags</h4>
      {flags.length ? (
        flags.map((f, i) => <FlagRow key={i} flag={f} />)
      ) : (
        <EmptyState>No flag is evaluated against this score.</EmptyState>
      )}
    </>
  );
}
