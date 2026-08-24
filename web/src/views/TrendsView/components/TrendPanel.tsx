"use client";

import { useState } from "react";

import { COLUMN_MARGIN, ColumnChart } from "@/lib/ux/charts/ColumnChart";
import { LineChart, type Margin } from "@/lib/ux/charts/LineChart";
import { MultiLineChart } from "@/lib/ux/charts/MultiLineChart";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Legend } from "@/lib/ux/primitives/Legend";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { num } from "@/lib/data/format";
import { axisPoints } from "../data/axis";
import { type Panel, type TrendPoint, stackTotal } from "../data/panels";
import { type Range, plotted, pointsIn, spanOf } from "../data/range";
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
 * TWO FORMS, DECIDED IN `panels.ts` AND NOT HERE. A per-day impulse is a
 * quantity per bucket and gets stacked bars; everything else is a state sampled
 * over time and gets a line. The choice is data because it belongs beside the
 * series it describes.
 *
 * `1000 x 320` RATHER THAN EITHER CHART'S DEFAULT. `.chart` is `width: 100%`
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
}: {
  panel: Panel;
  shown: TrendPoint[];
  range: Range | null;
}) {
  /* STATE PER PANEL, RESET BY THE KEY ABOVE. `TrendsView` renders this with
     `key={panel.key}`, so switching graph re-initialises both of these -- the
     two multi-series panels carry different series, and a checkbox set carried
     across them would mean nothing. The `<WeekView key={selected}>` precedent. */
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<string>(() => panel.modes?.[0]?.key ?? "");

  /* A MODE IS A DIFFERENT QUANTITY, SO IT IS A DIFFERENT POINT SET. Switching to
     min/mi does not reformat seconds -- it plots a different measurement on its
     own scale. Both modes cover the same dates, so the window is unaffected; this
     re-windows rather than reusing `shown` because relying on that coincidence is
     how the two would silently drift apart. */
  const active = panel.modes?.find((m) => m.key === mode) ?? panel.modes?.[0];
  const series = (panel.series ?? []).filter((s) => !off.has(s.key));
  const source = active?.points ?? panel.points;
  const slice = active ? pointsIn(active.points, range) : shown;
  const format = active?.format ?? panel.format;

  const total = plotted(source);
  const n = plotted(slice);
  // `spanOf` rather than the first and last element: one definition of where a
  // series runs, and it does not assume the points arrived sorted.
  const span = spanOf([panel]);
  const parts = panel.points.find((p) => p.parts)?.parts ?? [];

  /* THE SLICE IS COUNTED, THE AXIS IS DRAWN. `n of N` stays a count of
     MEASUREMENTS -- the slots `axisPoints` inserts for dates nobody measured are
     axis, not data, and counting them would inflate the caption with the very
     absence it exists to expose. */
  const columns = panel.kind === "columns";
  const margin = columns ? COLUMN_MARGIN : LINE_MARGIN;
  const drawn = axisPoints({
    points: slice,
    cadence: panel.cadence,
    innerWidth: W - margin.l - margin.r,
  });

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
      {panel.series ? (
        <div className="series-controls">
          <SeriesPicker
            series={panel.series}
            enabled={new Set(series.map((s) => s.key))}
            onToggle={toggle}
          />
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
              places={panel.places}
              format={format}
              points={drawn.map((p) => ({
                label: p.label,
                tick: p.tick,
                values: p.values ?? {},
                /* THE NUMBER BOTH PANELS DERIVE FROM, stated where the reader is
                   already looking. `lib/ux` is handed the wording rather than
                   learning what the quantity is. */
                note:
                  typeof p.vo2max === "number"
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
        ) : columns ? (
          <>
            <Legend items={parts.map((p) => ({ color: p.color, label: p.label }))} />
            <ColumnChart
              width={W}
              height={H}
              label={panel.title}
              columns={drawn.map((p) => ({
                label: p.label,
                tick: p.tick,
                parts: (p.parts ?? []).map((part) => ({
                  // `|| 0` so a component nobody measured contributes no height
                  // rather than dropping a day that WAS measured. The tooltip is
                  // where that absence is stated.
                  value: part.value || 0,
                  color: part.color,
                })),
                tip: () => (
                  <>
                    <b>{p.date}</b>
                    {(p.parts ?? []).map((part) => (
                      <TipRow
                        key={part.label}
                        k={part.label}
                        v={part.value === null ? "--" : panel.format(part.value)}
                      />
                    ))}
                    {/* A TOTAL IS ONLY A TOTAL WHEN EVERY COMPONENT WAS
                        MEASURED; `stackTotal` withholds rather than summing
                        what is present. */}
                    <TipRow
                      k="total"
                      v={
                        stackTotal(p) === null
                          ? "--"
                          : panel.format(stackTotal(p)!)
                      }
                    />
                  </>
                ),
              }))}
            />
          </>
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
