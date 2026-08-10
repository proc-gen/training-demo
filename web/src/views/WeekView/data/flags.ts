/* The flag blocks and their order.
 *
 * Both skills produce flags and they are shown together but never merged: a
 * token means something different depending on which model raised it, and
 * `monotony` in particular exists in both vocabularies with different
 * definitions.
 */

import type { Flag, Week } from "@/lib/data/payload";

/** `caveats` maps a flag TOKEN to the footnote that qualifies it.
 *
 * Populated on the Load block only, because only the load grader emits caveats
 * and a token means something different in each vocabulary -- which is the same
 * reason the blocks are never merged.
 */
export type FlagBlock = {
  title: string;
  flags: Flag[];
  caveats?: Record<string, string>;
};

/** Load caveats that name a flag, keyed by that flag's token.
 *
 * These are filtered out of the banner stack (see WeekBanners): a footnote to
 * one flag belongs under that flag, not above the whole week.
 */
export function flagCaveats(week: Week): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of week.load?.caveats ?? []) if (c.flag) out[c.flag] = c.text;
  return out;
}

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
    blocks.push({
      title: "Load",
      flags: firedFirst(week.load.flags),
      caveats: flagCaveats(week),
    });
  return blocks;
}
