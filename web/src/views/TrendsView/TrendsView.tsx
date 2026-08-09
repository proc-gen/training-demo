"use client";

import type { Payload } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Note } from "@/lib/ux/primitives/Note";
import { TrendPanel } from "./components/TrendPanel";
import { trendPanels } from "./data/panels";

/** Everything that only makes sense over time.
 *
 * Small multiples rather than one combined plot: the series here are in miles,
 * bpm, percent, SE, a ratio, hours and milliseconds, and putting any two of
 * them on one axis invites a comparison the data does not support.
 */
export function TrendsView({ payload }: { payload: Payload }) {
  const panels = trendPanels(payload);

  if (!panels.length) {
    return (
      <Card title="Trends">
        <EmptyState>No series yet.</EmptyState>
      </Card>
    );
  }

  return (
    <Card title="Trends">
      <div className="small-multiples">
        {panels.map((p) => (
          <TrendPanel key={p.key} panel={p} />
        ))}
      </div>
      <Note>
        Each panel is one series on one axis — never two scales on one plot.
        Colour follows the domain, not the panel: blue is adherence, orange is
        load, green is wellness. The value at the right edge is labelled; hover
        or focus any point for the rest.
      </Note>
    </Card>
  );
}
