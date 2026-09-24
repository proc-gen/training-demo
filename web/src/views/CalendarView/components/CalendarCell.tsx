"use client";

import { dayName, n, num, shortDate } from "@/lib/data/format";
import { roleLabel } from "@/lib/manifest/labels";
import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import type { PlanEntry } from "@/lib/run/data/runs";
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
import type { CalendarMode } from "../data/mode";

/** One day: what it was for, what it cost, and what was measured.
 *
 * IT IS A BUTTON IN VIEW MODE, because selecting it opens the day card below.
 * The tooltip handlers ride along unchanged -- the tooltip is the provenance
 * channel, the card is the detail one, and neither replaces the other.
 *
 * IN PLAN MODE IT IS NEITHER A BUTTON NOR A MEASUREMENT. The athlete's
 * instruction: *"the Plan mode doesn't care about scores, steps, or anything
 * that's been done. it cares about the prescriptions and the workouts
 * themselves. hovering over a day should give the full prescription for it."*
 * So the steps figure, the per-run scores, the bar and the over-ceiling outline
 * all go, the cell stops being clickable, and the tooltip carries the plan.
 * `useTip` still supplies `tabIndex: 0` and a focus/blur pair, so a Plan cell
 * is reachable without a pointer exactly as the button was -- a tooltip must
 * never be the only route to a value, and here it is the only route to the
 * UNCLIPPED prescription.
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
 *
 * ...AND THE PLAN-MODE CHECKMARK IS THE ONE THING ON THIS CELL THAT COMES FROM
 * A CLOCK, WHICH IS WHY IT ARRIVES ALREADY DECIDED. `done` is resolved by the
 * grid from a date read on the SERVER, so this component still reads none. It
 * is a MARK -- "this square is behind you" -- and never a verdict: a day whose
 * session was missed is marked exactly like one whose session was run, because
 * the mark is about the calendar and the score is about the training.
 * `data/dayDone.ts` states both halves.
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
  mode,
  rest,
  done,
}: {
  /** THE DATE IS ITS OWN PROP, not `d.date`. A window states its own dates, and
   *  a day the export has not covered -- every day of a week authored two
   *  Mondays out -- has no steps row at all while still having a prescription,
   *  a plan and a place in the grid. */
  date: string;
  d: Day | undefined;
  m: LoadDay | undefined;
  runs: RunResult[];
  /** The manifest's prescription per run, in `runs` order -- and each run's
   *  pre-authored alternates' words, which Plan mode says as `Alt:` lines.
   *  View mode never shows them: the day happened, and what stands in the
   *  record is the run, not the road not taken. */
  prescriptions: PlanEntry[];
  maxSteps: number;
  selected: boolean;
  onSelect: () => void;
  /** Which of the Calendar's two jobs this cell is doing. */
  mode: CalendarMode;
  /** Whether the PLAN schedules rest on this date. Plan mode only -- a rest day
   *  is a statement about the plan, and a cell with no runs would otherwise be
   *  indistinguishable from a date the manifest never mentions, which the
   *  graders treat as `unstated` rather than as rest. */
  rest: boolean;
  /** Whether this day is behind the athlete -- the plan states something for it
   *  and its date is today or earlier. Plan mode only, and it is a MARK rather
   *  than a status: `data/dayDone.ts` carries both halves of that distinction,
   *  and the grid decides it so this component reads no dates. */
  done: boolean;
}) {
  const plan = mode === "plan";
  const se = m?.se ?? null;
  const over = !plan && isOverCeiling(m);
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
        {!plan && m?.role ? " · " + roleLabel(m.role) : ""}
      </b>
      {/* VIEW'S ONLY. The emphasis phrase is what the CELL's tint already says
          and the prescriptions below say again in the plan's own words -- in
          View it qualifies a row of measurements, and in Plan it is a third
          spelling of the subject. */}
      {!plan && phrase ? <TipRow k="session" v={phrase} /> : null}

      {/* THE PRESCRIPTIONS, WHOLE, AND NOTHING ELSE. The cell clips these lines
          and Plan mode has no day card below, so this is the only place the
          full strings are readable -- which is the athlete's own reason for
          asking for the hover at all.

          IT CARRIED THE TARGET, THE CRITERION AND THE LENGTH FOR ABOUT AN HOUR,
          per run, and the athlete cut it: *"a little overkill on the tooltip.
          just want the full prescriptions and nothing else. the rest can stay
          in the modal after they click in to edit."* The pencil is one click
          away and states all of it against the fields that own it.

          PLAIN LINES, NOT `TipRow`. A `k: v` row is for a value with a name;
          these are the plan's own sentences, and a key column would put the
          role beside each one -- which is more of exactly what was cut. */}
      {plan ? (
        <>
          {prescriptions
            .filter((e) => e.text || e.alts.length)
            .map((e, i) => (
              <div key={i}>
                {e.text ? <div className="line">{e.text}</div> : null}
                {/* THE PLAN B, UNDER THE SESSION IT STANDS IN FOR. It is a
                    prescription, so it survives the athlete's "just the full
                    prescriptions" ruling; the `Alt:` word is what carries the
                    distinction, so no styling has to. */}
                {e.alts.map((a, j) => (
                  <div className="line" key={j}>
                    Alt: {a}
                  </div>
                ))}
              </div>
            ))}
          {rest ? <div className="line">rest day</div> : null}
          {!rest && !prescriptions.some((e) => e.text || e.alts.length) ? (
            <div className="line">nothing scheduled</div>
          ) : null}
        </>
      ) : (
        <>
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
      )}
    </>
  ));

  const className =
    "cal-cell" +
    (plan ? " plan" : "") +
    (over ? " over" : "") +
    (!plan && selected ? " is-selected" : "") +
    emphasisClass(tokens);

  const label = [
    `${dayName(date)} ${date}`,
    /* THE MARK IS NOT COLOUR-ONLY OR GLYPH-ONLY. A ✓ is `aria-hidden` below --
       a screen reader announcing "check mark" says nothing -- so the word is
       here, in the label the cell already composes. */
    plan && done ? "completed" : "",
    plan && rest ? "rest day" : "",
    phrase,
    /* Each session's words, and -- Plan mode only, like everywhere else the
       alternates appear -- an `Alt:` phrase per stand-in, so the label says
       what the cell and the tooltip say. */
    ...prescriptions.flatMap((e) => [
      e.text,
      ...(plan ? e.alts.map((a) => `Alt: ${a}`) : []),
    ]),
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      {/* THE MARK RIDES INSIDE THE DATE rather than in the corner, which is
          already taken: `.cal-slot .cal-edit` is absolutely positioned top
          right, and a ✓ there would sit under the pencil. Inside `.d` it also
          costs no layout change at all -- no wrapper, no new flex row. */}
      <span className="d">
        {shortDate(date)}
        {plan && done ? (
          <b className="cal-done" aria-hidden="true">
            ✓
          </b>
        ) : null}
      </span>

      {/* WHAT THE DAY IS FOR, before what it cost. One line per run, clipped by
          the stylesheet rather than truncated here -- a prescription cut in
          Python would be a second, shorter copy of a string the manifest owns,
          and the full text is in the tooltip and on the card either way. The
          `Alt:` lines are Plan mode's: in View the day happened, and the road
          not taken is not part of the record. */}
      {prescriptions.some((e) => e.text || (plan && e.alts.length)) ? (
        <span className="cal-plan">
          {prescriptions.flatMap((e, i) => [
            e.text ? <i key={`${i}-t`}>{e.text}</i> : null,
            ...(plan
              ? e.alts.map((a, j) => <i key={`${i}-a${j}`}>Alt: {a}</i>)
              : []),
          ])}
        </span>
      ) : null}

      {/* A SCHEDULED REST DAY SAYS SO. Plan mode only, and only because the
          alternative is an empty cell -- which means `unstated`, a different
          fact the graders report differently. */}
      {plan && rest ? <span className="cal-rest">rest</span> : null}

      {plan ? null : (
        <>
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
                  style={{
                    width: 100 * scale * (v / total) + "%",
                    background: color,
                  }}
                />
              ) : null,
            )}
          </span>
        </>
      )}
    </>
  );

  /* TWO ELEMENTS, ONE BODY. A Plan cell opens nothing, so it must not be a
     button: a control that does nothing when pressed is worse than no control.
     It keeps the tip handlers, which is what keeps it focusable. */
  return plan ? (
    <div
      className={className}
      style={{ background: emphasisBackground(tokens) }}
      aria-label={label}
      {...handlers}
    >
      {body}
    </div>
  ) : (
    <button
      type="button"
      className={className}
      style={{ background: emphasisBackground(tokens) }}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      {...handlers}
    >
      {body}
    </button>
  );
}
