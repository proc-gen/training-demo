/* The flag blocks and their order.
 *
 * Both skills produce flags and they are shown together but never merged: a
 * token means something different depending on which model raised it, and
 * `monotony` in particular exists in both vocabularies with different
 * definitions.
 */

import type { Flag, Week } from "@/lib/data/payload";

export type FlagBlock = { title: string; flags: Flag[] };

/** Fired first. A flag that fired is the reason to read the card.
 *
 * Stable within each group, so two fired flags keep the order the grader
 * emitted them in.
 */
export function firedFirst(flags: Flag[]): Flag[] {
  return [
    ...flags.filter((f) => f.status === "fired"),
    ...flags.filter((f) => f.status !== "fired"),
  ];
}

/** The blocks with flags in them, adherence before load.
 *
 * A half that produced NO flags contributes no block at all -- the card's own
 * empty state then says nothing was evaluated, which is a different statement
 * from "nothing fired".
 */
export function flagBlocks(week: Week): FlagBlock[] {
  const blocks: FlagBlock[] = [];
  if (week.adherence?.flags?.length)
    blocks.push({ title: "Adherence", flags: firedFirst(week.adherence.flags) });
  if (week.load?.flags?.length)
    blocks.push({ title: "Load", flags: firedFirst(week.load.flags) });
  return blocks;
}
