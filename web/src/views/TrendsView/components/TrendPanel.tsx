"use client";

import { LineChart } from "@/lib/ux/charts/LineChart";
import type { Panel } from "../data/panels";

/** One small multiple: a title, what it is, and one series.
 *
 * ONE SERIES ON ONE AXIS, so there is no legend -- the title names it. The
 * panel takes a spec rather than a dozen props so the decisions about colour,
 * reference line and formatting stay in one readable list.
 */
export function TrendPanel({ panel }: { panel: Panel }) {
  return (
    <div>
      <p className="sm-title">{panel.title}</p>
      <p className="sm-sub">{panel.sub}</p>
      <LineChart
        points={panel.points}
        title={panel.seriesTitle}
        label={panel.title}
        places={panel.places}
        zero={panel.zero}
        reference={panel.reference}
        color={panel.color}
        format={panel.format}
      />
    </div>
  );
}
