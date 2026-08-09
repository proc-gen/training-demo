"use client";

import type { Week } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { Meter } from "@/lib/ux/primitives/Meter";
import { weekFacts } from "../data/facts";
import { FactsTable } from "./FactsTable";

/** The two headline scores, their components, and the unscored facts.
 *
 * TWO figures, never one combined number. Adherence and load answer different
 * questions off different instruments -- 2026-08-01 scores 99 on adherence and
 * 51 on load, and an average of those two describes no day that happened.
 */
export function ScoreCard({ week }: { week: Week }) {
  const a = week.adherence;
  const l = week.load;
  const m = (week.manifest ?? {}) as { week_type?: string; phase?: string };
  const facts = weekFacts(a);

  return (
    <Card>
      <h3>
        {"Week of " + week.week_start}
        {m.week_type ? " — " + m.week_type : ""}
        {m.phase ? ", " + m.phase : ""}
      </h3>

      <div className="hero">
        <div>
          <span className="figure">
            {a?.scores?.week?.pct != null ? Math.round(a.scores.week.pct) : "--"}
          </span>
          <span className="of"> / 100 adherence</span>
        </div>
        <div>
          <span className="figure">
            {l?.overall != null ? Math.round(l.overall) : "--"}
          </span>
          <span className="of"> / 100 load</span>
        </div>
      </div>

      <div className="meters">
        {a ? <Meter label="Easy discipline" value={a.scores?.easy?.pct} /> : null}
        {a ? <Meter label="Workout execution" value={a.scores?.workout?.pct} /> : null}
        {a ? <Meter label="Structure" value={a.structure?.pct} /> : null}
        {l ? <Meter label="Load integrity" value={(l.integrity as { pct?: number })?.pct} /> : null}
        {l ? <Meter label="Readiness" value={l.readiness?.pct} /> : null}
      </div>

      {facts ? <FactsTable facts={facts} /> : null}
    </Card>
  );
}
