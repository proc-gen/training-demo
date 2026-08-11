"use client";

import { useState } from "react";

import type { Week } from "@/lib/data/payload";
import { Meter } from "@/lib/ux/primitives/Meter";
import { unmappedFlags } from "../data/flags";
import { componentByKey, componentsFor } from "../data/scoreComponents";
import { FlagRow } from "./FlagRow";
import { ScoreDetail } from "./ScoreDetail";

const PANEL_ID = "score-detail";

/** The two headline scores and their five components. The card's default tab.
 *
 * TWO figures, never one combined number. Adherence and load answer different
 * questions off different instruments -- 2026-08-01 scores 99 on adherence and
 * 51 on load, and an average of those two describes no day that happened.
 *
 * EVERY BAR OPENS. They were decoration until 2026-08-10: five numbers with
 * nothing saying which run, which day or which check cost the points, while the
 * flags that qualify the same numbers sat in a card two screens down. Clicking
 * one now opens its ledger and its flags underneath. THE STRUCTURE CHECKS ARE
 * IN THERE -- there was a Structure checks card as well until 2026-08-10, still
 * sitting below this one months after `structureLedger()` had absorbed it, and
 * the ledger is the better of the two: same checks, same `why` sentences, but
 * sorted failures-first and with the summation row that says how many left the
 * denominator.
 *
 * The selection is single: opening one closes the last, and clicking the open
 * one closes it. A card of five expanded panels is the wall of banners this page
 * has already been through once.
 *
 * IT NO LONGER OWNS THE WEEK'S TITLE OR ITS CARD. Both moved up to `WeekCard`
 * when this became one tab of four -- the title names the week, not this panel,
 * and it has to stay put while Training and Load swap in beneath it. Which means
 * the disclosure state below is scoped to a VISIT: leaving for another tab
 * unmounts this and closes whatever was open. That is the right default; a bar
 * reopening itself on return would restore a reading the reader had finished.
 */
export function OverallPanel({ week }: { week: Week }) {
  const [open, setOpen] = useState<string | null>(null);
  const a = week.adherence;
  const l = week.load;
  const components = componentsFor(week);
  const selected = componentByKey(open);
  const orphans = unmappedFlags(week);

  return (
    <>
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
        {components.map((c) => (
          <Meter
            key={c.key}
            label={c.label}
            value={c.score(week)}
            selected={open === c.key}
            panelId={PANEL_ID}
            onClick={() => setOpen((v) => (v === c.key ? null : c.key))}
          />
        ))}
      </div>

      {components.length ? (
        <p className="note">Click a score for what it is built from.</p>
      ) : null}

      {selected ? (
        <ScoreDetail week={week} component={selected} id={PANEL_ID} />
      ) : null}

      {/* A flag no score claims. It cannot be allowed to disappear just because
          nothing has decided where it belongs -- a flag nobody sees is worse
          than no flag, because the page reads as though it was checked.
          `flags.test.ts` asserts this list is empty for every published week. */}
      {orphans.length ? (
        <div className="unmapped">
          <h4>Not attached to a score</h4>
          {orphans.map((f, i) => (
            <FlagRow key={i} flag={f} />
          ))}
        </div>
      ) : null}
    </>
  );
}
