"use client";

import { useState } from "react";

import { LineChart, type Margin } from "@/lib/ux/charts/LineChart";
import { MultiLineChart } from "@/lib/ux/charts/MultiLineChart";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { num, shortDate } from "@/lib/data/format";
import type { Agg } from "../data/aggregate";
import { axisPoints, slotAt } from "../data/axis";
import type { Panel, TrendPoint } from "../data/panels";
import { type Range, plotted, pointsIn, spanOf } from "../data/range";
import { AggPicker } from "./AggPicker";
import { GroupPicker } from "./GroupPicker";
import { MarksToggle } from "./MarksToggle";
import { PeriodPicker } from "./PeriodPicker";
import { SeriesPicker } from "./SeriesPicker";
import { UnitToggle } from "./UnitToggle";

/** The plot box. `1000 x 320` rather than either chart's default -- see below. */
const W = 1000;
const H = 320;

/** The line chart's margins, wide enough on the left for `213,368 SE`. */
const LINE_MARGIN: Margin = { t: 16, r: 70, b: 30, l: 76 };

/** The one graph on show: a title, the window it covers, and the series.
 *
 * IT TAKES THE WHOLE SERIES AND THE WINDOWED SLICE, and needs both: the slice is
 * what it draws, and the whole is what lets it say `31 of 76 points` rather than
 * a bare count.
 *
 * EVERY PANEL IS A LINE. The one stacked-bar panel -- Daily TRIMP -- merged
 * into the multi-series fitness panel on 2026-08-27 at the athlete's
 * instruction, and the columns branch went with it rather than surviving as a
 * path no panel takes.
 *
 * `1000 x 320` RATHER THAN THE CHART'S DEFAULT. `.chart` is `width: 100%`
 * over a viewBox, so the whole drawing scales to the container: the line chart's
 * old 340-wide box stretched across a full card would render its 11px axis text
 * at something like 33. The line chart's margins go with it, because its y label
 * is drawn right-aligned ending 6 units left of the plot and `213,368 SE` is
 * wider than the 40 the small multiples allowed.
 *
 * THE SLICE IS NOT THE AXIS. `shown` is what was measured inside the window;
 * `axisPoints` turns it into one slot per date, labelled on calendar
 * boundaries. Both charts are handed the slots and neither knows what a date
 * is -- see `data/axis.ts`. This component owns the margins, so it is also
 * where the label budget is worked out from.
 *
 * THERE IS NO SUBTITLE. It carried a description and, where there was one, an
 * omission sentence; the athlete asked for the line to go on 2026-08-15. The
 * omissions still happen -- see `trendPanels` -- and are now reported in
 * conversation rather than on the page.
 */
export function TrendPanel({
  panel,
  shown,
  range,
  agg,
  onAgg,
}: {
  panel: Panel;
  shown: TrendPoint[];
  range: Range | null;
  /** The aggregation state, handed over ONLY for an `aggregable` panel — the
   *  `UnitToggle` rule: the controls render only where there is a choice. The
   *  state itself lives in `TrendsView`, beside the window, because the
   *  `key={panel.key}` remount would reset it here and the aggregation should
   *  survive a graph switch exactly as the window does. */
  agg?: Agg;
  onAgg?: (agg: Agg) => void;
}) {
  /* STATE PER PANEL, RESET BY THE KEY ABOVE. `TrendsView` renders this with
     `key={panel.key}`, so switching graph re-initialises both of these -- the
     two multi-series panels carry different series, and a checkbox set carried
     across them would mean nothing. The `<WeekView key={selected}>` precedent. */
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<string>(() => panel.modes?.[0]?.key ?? "");
  /* THE GROUP SEEDS FROM `defaultGroup`, which names it. The panel own
     `series`/`points` are that group too, so the dropdown and the plot agree on
     the first paint -- and they agree by a stated key rather than by which array
     object happens to be shared. */
  const [group, setGroup] = useState<string>(
    () => panel.defaultGroup ?? panel.groups?.[0]?.key ?? "",
  );
  /* WHETHER THE WORKOUT DOTS ARE DRAWN AT ALL -- panel-level, surviving a group
     change, because marks are orthogonal to which series set is showing. Hiding
     them passes `[]` to the chart, which also takes them out of the y scale:
     a hidden measurement must not shape the axis. */
  const [showMarks, setShowMarks] = useState(true);

  /* A MODE IS A DIFFERENT QUANTITY, SO IT IS A DIFFERENT POINT SET. Switching to
     min/mi does not reformat seconds -- it plots a different measurement on its
     own scale. Both modes cover the same dates, so the window is unaffected; this
     re-windows rather than reusing `shown` because relying on that coincidence is
     how the two would silently drift apart. */
  const active = panel.modes?.find((m) => m.key === mode) ?? panel.modes?.[0];
  /* A GROUP SUPERSEDES the panel's own `series` and `points`; `modes` are the
     other axis and no panel carries both -- see `PanelGroup`. */
  const chosen = panel.groups?.find((g) => g.key === group) ?? panel.groups?.[0];
  const series = (chosen?.series ?? panel.series ?? []).filter((s) => !off.has(s.key));
  const source = active?.points ?? chosen?.points ?? panel.points;
  const slice = active
    ? pointsIn(active.points, range)
    : chosen
      ? pointsIn(chosen.points, range)
      : shown;
  const format = active?.format ?? panel.format;

  const total = plotted(source);
  const n = plotted(slice);
  // `spanOf` rather than the first and last element: one definition of where a
  // series runs, and it does not assume the points arrived sorted.
  const span = spanOf([panel]);

  /* THE SLICE IS COUNTED, THE AXIS IS DRAWN. `n of N` stays a count of
     MEASUREMENTS -- the slots `axisPoints` inserts for dates nobody measured are
     axis, not data, and counting them would inflate the caption with the very
     absence it exists to expose. */
  const drawn = axisPoints({
    points: slice,
    cadence: panel.cadence,
    innerWidth: W - LINE_MARGIN.l - LINE_MARGIN.r,
  });

  /* WHAT WAS ACTUALLY RUN, placed on the grid the points just decided. A DATE
     becomes a fractional slot index -- a Tuesday workout has no slot of its own
     on a weekly axis, and `slotAt` is the one place that decision is written
     down.

     `slotAt` IS THE WINDOW TOO, and deliberately not `pointsIn` on top of it.
     `drawn` runs from the first drawn point in the slice to the last, which is
     always inside the range and usually narrower than it, so a range filter here
     would be a no-op that reads as load-bearing. A mark `slotAt` refuses is one
     whose week the window clipped: there is no pair of slots to place it
     between, and extrapolating past the last would draw it outside the plot.

     The tooltip's own line is the ISO date -- `ColumnChart`'s precedent -- since
     "8/18" is shared by every year and a session is the one thing on this chart
     a reader may want to go and look up. */
  /* THE MODE LEADS, mirroring the `source`/`format` lookups above: a mode is a
     different quantity, so its marks are different numbers for the same
     observations, and falling through to `panel.marks` on a moded panel would
     plot seconds on a min/mi scale silently. */
  const placed = (active?.marks ?? chosen?.marks ?? panel.marks ?? []).flatMap(
    (m) => {
      const at = slotAt(m.date, drawn, panel.cadence);
      if (at === null) return [];
      return [
        {
          at,
          key: m.key,
          color: m.color,
          name: m.name,
          value: m.value,
          label: m.date,
          note: { k: m.kind ?? "workout", v: m.detail },
        },
      ];
    },
  );

  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      // TRACKED AS WHAT IS OFF, NOT WHAT IS ON. An empty set is "everything
      // showing", which is the default the athlete asked for -- and it means a
      // series added to a chart later arrives ENABLED rather than silently
      // hidden by a stale enabled-list.
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <p className="sm-title">{panel.title}</p>
      <p className="sm-range">
        {range ? `${range.from} → ${range.to} · ` : ""}
        {n} of {total} points
      </p>
      {agg && onAgg ? (
        <div className="agg-controls">
          <AggPicker mode={agg.mode} onMode={(mode) => onAgg({ ...agg, mode })} />
          <PeriodPicker
            period={agg.period}
            onPeriod={(period) => onAgg({ ...agg, period })}
          />
        </div>
      ) : null}
      {panel.series ? (
        <div className="series-controls">
          {panel.groups && panel.groups.length > 1 ? (
            <GroupPicker
              groups={panel.groups}
              selected={chosen?.key ?? ""}
              /* A DIFFERENT GROUP IS A DIFFERENT SERIES SET, so the ticks reset
                 with it. Carrying `off` across would hide a zone in the new
                 group that happens to share a key with one hidden in the old,
                 and leave the reader hunting for a series they never unticked. */
              onSelect={(k) => {
                setGroup(k);
                setOff(new Set());
              }}
            />
          ) : null}
          <SeriesPicker
            series={chosen?.series ?? panel.series}
            enabled={new Set(series.map((s) => s.key))}
            onToggle={toggle}
          />
          {/* PANEL-LEVEL PRESENCE, so the control does not pop in and out as
              the group dropdown moves between groups with and without marks. */}
          {(panel.groups ?? []).some((g) => (g.marks ?? []).length > 0) ||
          (panel.marks ?? []).length > 0 ? (
            <MarksToggle
              label={panel.marksLabel ?? "Workouts"}
              checked={showMarks}
              onToggle={() => setShowMarks((v) => !v)}
            />
          ) : null}
          {panel.modes && panel.modes.length > 1 ? (
            <UnitToggle
              modes={panel.modes}
              selected={active?.key ?? ""}
              onSelect={setMode}
            />
          ) : null}
        </div>
      ) : null}
      {n ? (
        panel.series ? (
          series.length ? (
            <MultiLineChart
              width={W}
              height={H}
              margin={LINE_MARGIN}
              label={panel.title}
              series={series}
              marks={showMarks ? placed : []}
              places={panel.places}
              reference={panel.reference}
              format={format}
              points={drawn.map((p) => ({
                label: p.label,
                tick: p.tick,
                values: p.values ?? {},
                /* THE NUMBER BOTH PANELS DERIVE FROM, stated where the reader is
                   already looking. `lib/ux` is handed the wording rather than
                   learning what the quantity is. A CARRIED point states its
                   provenance instead -- the carried-forward rule: a chart
                   restated under a later date must SAY so, and its VO2max is
                   the source chart's measurement, not this Sunday's. */
                note: p.carried
                  ? { k: "chart", v: `carried from ${shortDate(p.carried)}` }
                  : typeof p.vo2max === "number"
                    ? { k: "VO2max", v: num(p.vo2max, 2) }
                    : null,
              }))}
            />
          ) : (
            /* EVERY BOX UNTICKED IS A CHOICE, NOT AN ABSENCE, so it gets its own
               sentence rather than the "no points in this range" one below --
               which would send the reader off to fix a window that is fine. */
            <EmptyState>No series selected.</EmptyState>
          )
        ) : (
          <LineChart
            points={drawn}
            width={W}
            height={H}
            margin={LINE_MARGIN}
            title={panel.seriesTitle}
            label={panel.title}
            places={panel.places}
            zero={panel.zero}
            reference={panel.reference}
            color={panel.color}
            format={panel.format}
            pointsOnly={panel.pointsOnly}
            bandTitle={panel.bandTitle}
          />
        )
      ) : (
        /* NEVER A BLANK PLOT. An empty chart states that a measurement exists
         * and is flat, which is the same reason `trendPanels` omits a panel
         * with no series at all rather than drawing one. The sentence names
         * where the series DOES run, so the window can be fixed without
         * hunting for it. */
        <EmptyState>
          No points in this range.
          {span ? ` ${panel.title} runs ${span.from} → ${span.to}.` : ""}
        </EmptyState>
      )}
    </div>
  );
}
