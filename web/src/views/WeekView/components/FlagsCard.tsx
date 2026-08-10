"use client";

import type { Week } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { flagBlocks } from "../data/flags";
import { FlagRow } from "./FlagRow";

/** Both skills' flags, grouped by skill and fired first.
 *
 * Grouped and never merged: a token means something different depending on
 * which model raised it, and `monotony` exists in both vocabularies with
 * different definitions.
 */
export function FlagsCard({ week }: { week: Week }) {
  const blocks = flagBlocks(week);

  if (!blocks.length) {
    return (
      <Card title="Flags">
        <EmptyState>No flags evaluated.</EmptyState>
      </Card>
    );
  }

  return (
    <Card title="Flags">
      {blocks.map((b) => (
        <div key={b.title}>
          <h3>{b.title}</h3>
          {b.flags.map((f, i) => (
            <FlagRow key={i} flag={f} caveat={b.caveats?.[f.token ?? ""]} />
          ))}
        </div>
      ))}
    </Card>
  );
}
