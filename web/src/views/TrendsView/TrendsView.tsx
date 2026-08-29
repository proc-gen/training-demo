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
  shiftRange,
} from "./data/range";

/** Everything that only makes sense over time.
 *
 * ONE GRAPH AT A TIME, over a window the reader chooses. It was eleven small
 * multiples until 2026-08-15, which had two costs: no series was big enough to
 * read -- a whole year of daily HRV in a 430px box -- and every one of them
 * covered its entire history, so there was no way to ask what a measurement has
 * been doing lately.
 *
 * ONE AXIS PER PANEL, and series share it only when they share a unit: the
 * single-series panels are in miles, bpm, percent, SE, a ratio, hours and
 * milliseconds, and putting any two of THOSE on one axis invites a comparison
 * the data does not support. The fitness panel is the counter-case that proves
 * the rule -- TRIMP, CTL, ATL and TSB are all the TRIMP unit, so they merged
 * into one multi-series graph on 2026-08-27 at the athlete's instruction.
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

  /* THE PRESET STAYS PRESSED THROUGH A STEP, and that is deliberate. It names
     the window's LENGTH, not its position -- so a month-wide window is still
     `1 month` after it moves, and dropping to `custom` would disable the arrows
     after a single click, which is the opposite of what they are for. Where the
     window actually sits is stated twice already: in the From/To fields and in
     the panel's own `from → to · n of N points` line. Pressing the pill again
     re-anchors to the newest data, which is unchanged behaviour and doubles as
     a way back. */
  const shift = (steps: number) => {
    if (!range) return;
    const moved = shiftRange(range, preset, steps);
    if (moved) setRange(moved);
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
          onShift={shift}
        />
      </div>

      {/* NO CLOSING NOTE. It stated the colour convention and the one-scale
          rule, which are rules for whoever adds a panel rather than facts a
          reader needs; the athlete asked for it on 2026-08-15. Both rules are
          still enforced -- they live in `trendPanels`' header, beside the list
          they govern. */}
      {/* KEYED ON THE PANEL, so changing graph re-initialises the panel's own
          state -- which series are ticked, and which unit a mode-carrying panel
          is showing. The multi-series panels carry entirely different series,
          so a checkbox set carried across them would mean nothing. Same one-line
          reset `Report` gets from `<WeekView key={selected}>`. The WINDOW is
          deliberately NOT reset: it lives above this and is shared, because
          comparing two series over the same dates is why a reader switches. */}
      <TrendPanel
        key={panel.key}
        panel={panel}
        shown={pointsIn(panel.points, range)}
        range={range}
      />
    </Card>
  );
}
