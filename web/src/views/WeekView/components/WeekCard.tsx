"use client";

import { useState } from "react";

import type { Week } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { Tabs, tabId } from "@/lib/ux/primitives/Tabs";
import { DEFAULT_PANEL, activeKey, panelsFor } from "../data/weekPanels";
import { CommentaryPanel } from "./CommentaryPanel";
import { LoadPanel } from "./LoadPanel";
import { OverallPanel } from "./OverallPanel";
import { TrainingPanel } from "./TrainingPanel";

const PANEL_ID = "week-panel";

/** One week, one card, four tabs.
 *
 * It was five stacked cards -- score, runs, structure checks, total load,
 * commentary -- and reaching any one of them meant scrolling past the others.
 * The top bar had already solved this shape once with Week / Calendar / Trends,
 * so the same move applies a level down and the strip is literally the same
 * component.
 *
 * THE TITLE IS THE ONE THING THAT PERSISTS. The hero figures went with Overall
 * rather than staying above the strip: they are that panel's subject, and
 * Training and Load want the height. What has to stay is the week's identity,
 * because every tab is about the same week and a reader who has scrolled into a
 * run table needs to know which one.
 *
 * The dispatch is inline ternaries keyed on the active panel, matching the
 * shape `Report` uses for the three views. A lookup table mapping key to
 * component would read tidier and would put four components in a file the
 * one-component-per-file rule is about.
 */
export function WeekCard({ week }: { week: Week }) {
  const [chosen, setChosen] = useState<string>(DEFAULT_PANEL);
  const panels = panelsFor(week);
  /* NOT `chosen` DIRECTLY. The selection outlives the week -- `Report` renders
   * `WeekView` with no key -- so a Commentary tab picked on one week arrives at
   * the next, which may have no note. `activeKey` is where that falls back. */
  const active = activeKey(week, chosen);
  /* `manifest` is a loose object -- the exporter's allowlist decides what
   * actually reaches it, so the schema does not restate the shape. Named here
   * rather than read through, which is what keeps these two `unknown`. */
  const m = (week.manifest ?? {}) as { week_type?: string; phase?: string };
  /* The cutoff, but ONLY while it is short of the week's end -- which is the
   * grader's own way of saying this week is still being lived. Both fields come
   * from the adherence record; a week whose adherence did not grade shows
   * nothing, which is right, because then there is no partial score to qualify. */
  const a = week.adherence;
  /* THREE STATES, not two. `graded_through` is null on a live week whose first
   * session has not landed -- nothing in it has come due -- and that is a week
   * that must say so LOUDEST, not one that says nothing. Falling through to
   * `null` here would have printed it exactly like a settled week. */
  const live =
    a?.week_end && (!a.graded_through || a.graded_through < a.week_end)
      ? (a.graded_through ?? "nothing yet")
      : null;

  return (
    <Card>
      <div className="card-head">
        <h3>
          {"Week of " + week.week_start}
          {m.week_type ? " — " + m.week_type : ""}
          {m.phase ? ", " + m.phase : ""}
          {/* A LIVE WEEK MUST SAY SO. It is judged only through
              `min(today, week_end)`, so while it is in progress every score on
              this card covers PART of the week -- and a partial score printed
              like a whole-week one is the defect that produced `Structure 33`
              off two days of running. Absent on a finished week, where
              `graded_through` IS the week's end and there is nothing to
              qualify. */}
          {live ? (
            <span className="sec"> · evaluated through {live}</span>
          ) : null}
        </h3>

        {/* One tab is not a choice, and a lone pill reads as a filter somebody
            forgot to finish. A week where neither grader ran shows its two
            dashes with no strip at all. */}
        {panels.length > 1 ? (
          <Tabs
            items={panels}
            active={active}
            onSelect={setChosen}
            label="Week section"
            panelId={PANEL_ID}
            className="in-card"
          />
        ) : null}
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={panels.length > 1 ? tabId(PANEL_ID, active) : undefined}
      >
        {active === "overall" ? <OverallPanel week={week} /> : null}
        {active === "training" ? <TrainingPanel week={week} /> : null}
        {active === "load" ? <LoadPanel week={week} /> : null}
        {active === "commentary" ? <CommentaryPanel week={week} /> : null}
      </div>
    </Card>
  );
}
