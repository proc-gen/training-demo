"use client";

import { useState } from "react";

import type { Payload } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { GraphPicker } from "./components/GraphPicker";
import { RangePicker } from "./components/RangePicker";
import { TrendPanel } from "./components/TrendPanel";
import { trendPanels } from "./data/panels";
import {
  DEFAULT_PRESET,
  type PresetKey,
  type Range,
  defaultRange,
  pointsIn,
  presetRange,
} from "./data/range";

/** Everything that only makes sense over time.
 *
 * ONE GRAPH AT A TIME, over a window the reader chooses. It was eleven small
 * multiples until 2026-08-15, which had two costs: no series was big enough to
 * read -- a whole year of daily HRV in a 430px box -- and every one of them
 * covered its entire history, so there was no way to ask what a measurement has
 * been doing lately.
 *
 * The panels themselves are unchanged and still one series on one axis: the
 * series here are in miles, bpm, percent, SE, a ratio, hours and milliseconds,
 * and putting any two of them on one axis invites a comparison the data does
 * not support.
 *
 * THE WINDOW IS SHARED ACROSS GRAPHS AND THE GRAPH CHOICE DOES NOT MOVE IT.
 * Switching series to compare two of them over the same dates is the whole
 * reason a reader switches, and a range that re-resolved per panel would answer
 * a different question each time. It is why the four weekly-cadence series show
 * four or five points at the default month; widening is one click.
 *
 * The state is here rather than in `Report` because `Report` holds one thing --
 * which view is showing. It resets when the tab is left, like every other view's
 * does.
 */
export function TrendsView({ payload }: { payload: Payload }) {
  const panels = trendPanels(payload);

  const [key, setKey] = useState<string>(() => panels[0]?.key ?? "");
  const [preset, setPreset] = useState<PresetKey>(DEFAULT_PRESET);
  const [range, setRange] = useState<Range | null>(() => defaultRange(panels));

  if (!panels.length) {
    return (
      <Card title="Trends">
        <EmptyState>No series yet.</EmptyState>
      </Card>
    );
  }

  // A key that is no longer in the list falls back rather than rendering
  // nothing: a blank card cannot say whether the series went away or the app
  // broke.
  const panel = panels.find((p) => p.key === key) ?? panels[0];

  const choose = (k: PresetKey) => {
    setPreset(k);
    const resolved = presetRange(panels, k);
    if (resolved) setRange(resolved);
  };

  const custom = (r: Range) => {
    setPreset("custom");
    setRange(r);
  };

  return (
    <Card title="Trends">
      <div className="trend-controls">
        <GraphPicker panels={panels} selected={panel.key} onSelect={setKey} />
        <RangePicker
          range={range}
          preset={preset}
          onPreset={choose}
          onCustom={custom}
        />
      </div>

      {/* NO CLOSING NOTE. It stated the colour convention and the one-scale
          rule, which are rules for whoever adds a panel rather than facts a
          reader needs; the athlete asked for it on 2026-08-15. Both rules are
          still enforced -- they live in `trendPanels`' header, beside the list
          they govern. */}
      <TrendPanel
        panel={panel}
        shown={pointsIn(panel.points, range)}
        range={range}
      />
    </Card>
  );
}
