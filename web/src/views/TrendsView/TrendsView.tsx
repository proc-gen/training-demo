"use client";

import { useMemo, useState } from "react";

import type { Payload } from "@/lib/data/payload";
import { PaceRail } from "@/lib/paces/PaceRail";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { RailLayout } from "@/lib/ux/primitives/RailLayout";
import { GraphPicker } from "./components/GraphPicker";
import { RangePicker } from "./components/RangePicker";
import { TrendPanel } from "./components/TrendPanel";
import { type Agg, DEFAULT_AGG, aggregatedPanel } from "./data/aggregate";
import { trendPanels } from "./data/panels";
import {
  DEFAULT_PRESET,
  type PresetKey,
  type Range,
  defaultRange,
  pointsIn,
  presetRange,
  shiftRange,
  shiftWeeks,
} from "./data/range";
import { vo2maxPanel } from "./data/vo2maxPanel";

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
  /* MEMOISED ON THE PAYLOAD since 2026-09-09. Building the panels prices the
     race-times series and the VO2max series at every day of the record, and
     the custom-window box below re-renders this view on each commit; rebuilt
     per render, every keystroke's blur would repeat all of it for a value
     that had not changed. */
  const panels = useMemo(() => trendPanels(payload), [payload]);

  const [key, setKey] = useState<string>(() => panels[0]?.key ?? "");
  const [preset, setPreset] = useState<PresetKey>(DEFAULT_PRESET);
  const [range, setRange] = useState<Range | null>(() => defaultRange(panels));
  /* SHARED ACROSS THE THREE AGGREGABLE PANELS, for the reason the window is
     shared: the athlete switches series to compare them over the same dates,
     and now the same aggregation. It also cannot live in `TrendPanel` — the
     `key={panel.key}` remount below would silently reset it on every graph
     switch, which is correct for series ticks and wrong for this. */
  const [agg, setAgg] = useState<Agg>(DEFAULT_AGG);
  /* THE CUSTOM VO2MAX WINDOW, held here for the identical reason: a typed
     comparison should survive a detour through Volume and back. Null is "no
     third line", which is also how `trendPanels` built the base panel. */
  const [customWindow, setCustomWindow] = useState<number | null>(null);

  // A key that is no longer in the list falls back rather than rendering
  // nothing: a blank card cannot say whether the series went away or the app
  // broke.
  const panel = panels.find((p) => p.key === key) ?? panels[0];
  /* THE AGGREGATED VIEW OF IT — the identity for the default aggregation and
     for every non-aggregable panel. THE WINDOW DOES NOT MOVE: `defaultRange`
     above and `presetRange`/`shift` below keep reading the BASE panels, so
     changing aggregation, like changing graph, never re-resolves the window —
     and every aggregated point falls inside the base span (bucket starts are
     at or after the first covered day, rolling points start N−1 days in).

     THE WINDOWED PANEL IS REBUILT THE SAME WAY, with the typed window: a third
     series at that length, or the base panel again when nothing valid has
     been typed. Its span is the sample span whatever the length, so the date
     window is unmoved here too. Memoised because the rebuild walks the whole
     VO2max series per window. Hooks sit above the early return below. */
  const shownPanel = useMemo(() => {
    if (!panel) return panel;
    if (panel.aggregable) return aggregatedPanel(panel, payload, agg);
    if (panel.windowed) return vo2maxPanel(payload, customWindow) ?? panel;
    return panel;
  }, [panel, payload, agg, customWindow]);

  /* THE RAIL, WITH NO WEEK. This view is about no week in particular, so the
     tables drop their "This week" column entirely rather than filling one with
     dashes -- a heading naming a week the page does not have would invent one.
     The paces still belong here: every graph on this page is a series the
     targets qualify, and the projected race times panel is drawn from the same
     anchor. */
  const rail = <PaceRail current={payload.pace_chart_current} />;

  if (!panels.length || !panel || !shownPanel) {
    return (
      <RailLayout rail={rail}>
        <Card title="Trends">
          <EmptyState>No series yet.</EmptyState>
        </Card>
      </RailLayout>
    );
  }

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

  /* THE FINER STEP, AND IT WORKS WHERE THE COARSE ONE REFUSES. A week is an
     increment every window has, so these arrows are live on `All` and on a
     typed window -- the athlete's call, and `RangePicker` says why it is not an
     exception to the rule beside it.

     `All` IS THE ONE PRESET A STEP CANNOT SURVIVE, and that is the difference
     between it and the four above it. `1 month` names the window's LENGTH,
     which a step preserves; `All` claims the window IS the data, which stops
     being true the moment it moves. So the label gives way to `Custom` -- and
     the coarse arrows, dead on both, are unaffected either way. */
  const shiftByWeeks = (steps: number) => {
    if (!range) return;
    if (preset === "all") setPreset("custom");
    setRange(shiftWeeks(range, steps));
  };

  return (
    <RailLayout rail={rail}>
      <Card title="Trends">
        <div className="trend-controls">
          <GraphPicker panels={panels} selected={panel.key} onSelect={setKey} />
          <RangePicker
            range={range}
            preset={preset}
            onPreset={choose}
            onCustom={custom}
            onShift={shift}
            onShiftWeek={shiftByWeeks}
          />
        </div>

        {/* NO CLOSING NOTE. It stated the colour convention and the one-scale
            rule, which are rules for whoever adds a panel rather than facts a
            reader needs; the athlete asked for it on 2026-08-15. Both rules are
            still enforced -- they live in `trendPanels`' header, beside the list
            they govern. */}
        {/* KEYED ON THE PANEL, so changing graph re-initialises the panel's own
            state -- which series are ticked, and which unit a mode-carrying
            panel is showing. The multi-series panels carry entirely different
            series, so a checkbox set carried across them would mean nothing.
            Same one-line reset `Report` gets from `<WeekView key={selected}>`.
            The WINDOW is deliberately NOT reset: it lives above this and is
            shared, because comparing two series over the same dates is why a
            reader switches. */}
        <TrendPanel
          key={panel.key}
          panel={shownPanel}
          shown={pointsIn(shownPanel.points, range)}
          range={range}
          /* Only an aggregable panel gets the controls — the `UnitToggle` rule.
             The state rides above the key so it survives the switch. */
          agg={panel.aggregable ? agg : undefined}
          onAgg={panel.aggregable ? setAgg : undefined}
          /* And the window box only to the windowed one, the same rule. */
          customWindow={panel.windowed ? customWindow : undefined}
          onCustomWindow={panel.windowed ? setCustomWindow : undefined}
        />
      </Card>
    </RailLayout>
  );
}
