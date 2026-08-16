"use client";

import { dayName, n, num, shortDate } from "@/lib/data/format";
import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import { Dot } from "@/lib/ux/primitives/Dot";
import { RUN_STATUS_LABEL, isPlanned, runStatus } from "@/lib/run/data/runStatus";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { useTip } from "@/lib/ux/tooltip/hooks/useTip";
import {
  dayEmphasis,
  emphasisBackground,
  emphasisClass,
  emphasisPhrase,
} from "../data/emphasis";
import { isOverCeiling } from "../data/days";

/** One day: what it was for, what it cost, and what was measured.
 *
 * IT IS A BUTTON NOW, because selecting it opens the day card below. The
 * tooltip handlers ride along unchanged -- the tooltip is the provenance
 * channel, the card is the detail one, and neither replaces the other.
 *
 * THE BAR IS SCALED IN STEPS against the busiest day on record -- see
 * `maxSteps` for why it cannot be step-equivalents. SE, the ceiling and the
 * breach outline ride along only where the graders produced them.
 *
 * WHAT THE CELL SAYS, AND WHY IT IS NOT ONLY COLOUR. The tint says long run /
 * race / quality work, and the PRESCRIPTION under the date says the same thing
 * in the plan's own words -- so a reader who cannot separate the hues loses
 * nothing. That is what discharges the concern the deleted day table used to
 * carry: every value a cell encodes is also written in it, or in the tooltip,
 * or in the card it opens.
 *
 * A SCORE PER RUN, NEVER A DAY AVERAGE. Averaging two runs would be a scoring
 * rule invented in the browser, and `roll_up()` weights by seconds rather than
 * by run -- so the browser's number would be a different quantity wearing the
 * same name. A planned run shows its status word instead, which the GRADER
 * resolved: the page reads no clock.
 */
export function CalendarCell({
  date,
  d,
  m,
  runs,
  prescriptions,
  maxSteps,
  selected,
  onSelect,
}: {
  /** THE DATE IS ITS OWN PROP, not `d.date`. A window states its own dates, and
   *  a day the export has not covered -- every day of a week authored two
   *  Mondays out -- has no steps row at all while still having a prescription,
   *  a plan and a place in the grid. */
  date: string;
  d: Day | undefined;
  m: LoadDay | undefined;
  runs: RunResult[];
  /** The manifest's prescription per run, in `runs` order. */
  prescriptions: string[];
  maxSteps: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const se = m?.se ?? null;
  const over = isOverCeiling(m);
  const total = n(d?.total_steps) || 0;
  const runPart = n(d?.run_steps) || 0;
  const bgPart = n(d?.nonrun_steps) || 0;
  const scale = Math.max(0, Math.min(1, total / maxSteps));

  const tokens = dayEmphasis(runs);
  const phrase = emphasisPhrase(tokens);

  const handlers = useTip(() => (
    <>
      <b>
        {dayName(date)} {date}
        {m?.role ? " · " + m.role : ""}
      </b>
      {phrase ? <TipRow k="session" v={phrase} /> : null}
      <TipRow k="steps" v={num(n(d?.total_steps))} />
      {se ? (
        <>
          <TipRow k="run SE" v={num(m?.run_se)} />
          <TipRow k="background SE" v={num(m?.nonrun_se)} />
          <TipRow k="day SE" v={num(se)} />
          <TipRow k="ceiling" v={num(m?.ceiling)} />
          <TipRow k="ceiling from" v={m?.ceiling_source || "unpriced"} />
          <TipRow k="run steps from" v={m?.run_step_source || "--"} />
          <TipRow k="data" v={m?.completeness || "--"} />
        </>
      ) : null}
      {d?.resting_hr ? <TipRow k="resting HR" v={d.resting_hr} /> : null}
      {d?.sleep_hours ? <TipRow k="sleep" v={`${d.sleep_hours} h`} /> : null}
    </>
  ));

  return (
    <button
      type="button"
      className={
        "cal-cell" +
        (over ? " over" : "") +
        (selected ? " is-selected" : "") +
        emphasisClass(tokens)
      }
      style={{ background: emphasisBackground(tokens) }}
      aria-pressed={selected}
      aria-label={
        [`${dayName(date)} ${date}`, phrase, ...prescriptions.filter(Boolean)]
          .filter(Boolean)
          .join(" · ")
      }
      onClick={onSelect}
      {...handlers}
    >
      <span className="d">{shortDate(date)}</span>

      {/* WHAT THE DAY IS FOR, before what it cost. One line per run, clipped by
          the stylesheet rather than truncated here -- a prescription cut in
          Python would be a second, shorter copy of a string the manifest owns,
          and the full text is in the tooltip and on the card either way. */}
      {prescriptions.some(Boolean) ? (
        <span className="cal-plan">
          {prescriptions.map((p, i) => (p ? <i key={i}>{p}</i> : null))}
        </span>
      ) : null}

      <span className="cal-foot">
        <span className="v">{num(n(d?.total_steps))}</span>
        {runs.length ? (
          <span className="cal-scores">
            {runs.map((r, i) =>
              isPlanned(r) ? (
                <span className="muted" key={i}>
                  {RUN_STATUS_LABEL[runStatus(r)]}
                </span>
              ) : r.pct === null || r.pct === undefined ? (
                <span className="muted" key={i}>
                  --
                </span>
              ) : (
                <span key={i}>
                  <Dot pct={r.pct} /> {Math.round(r.pct)}%
                </span>
              ),
            )}
          </span>
        ) : null}
      </span>

      <span className="cal-bar">
        {(
          [
            [runPart, "var(--series-1)"],
            [bgPart, "var(--series-2)"],
          ] as const
        ).map(([v, color], i) =>
          v && total ? (
            <i
              key={i}
              style={{ width: 100 * scale * (v / total) + "%", background: color }}
            />
          ) : null,
        )}
      </span>
    </button>
  );
}
