"use client";

import { ColumnChart } from "@/lib/ux/charts/ColumnChart";
import { LineChart } from "@/lib/ux/charts/LineChart";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Legend } from "@/lib/ux/primitives/Legend";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { type Panel, type TrendPoint, stackTotal } from "../data/panels";
import { type Range, plotted, spanOf } from "../data/range";

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
  const total = plotted(panel.points);
  const n = plotted(shown);
  // `spanOf` rather than the first and last element: one definition of where a
  // series runs, and it does not assume the points arrived sorted.
  const span = spanOf([panel]);
  const parts = panel.points.find((p) => p.parts)?.parts ?? [];

  return (
    <div>
      <p className="sm-title">{panel.title}</p>
      <p className="sm-range">
        {range ? `${range.from} → ${range.to} · ` : ""}
        {n} of {total} points
      </p>
      {n ? (
        panel.kind === "columns" ? (
          <>
            <Legend items={parts.map((p) => ({ color: p.color, label: p.label }))} />
            <ColumnChart
              width={1000}
              height={320}
              label={panel.title}
              columns={shown.map((p) => ({
                label: p.label,
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
            points={shown}
            width={1000}
            height={320}
            margin={{ t: 16, r: 70, b: 30, l: 76 }}
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
