"use client";

import { useState } from "react";

import { shortDate } from "@/lib/data/format";
import { STATIC_DATA } from "@/lib/data/staticData";
import {
  refusedWeeks,
  useManifestEditor,
  type RegradeOutcome,
} from "../hooks/useManifestEditor";

/** Grades every week with edits not yet graded, in ONE publish.
 *
 * WHY IT EXISTS: a save used to run `publish.py` itself, which regrades every
 * week (~14 s) whatever changed -- so entering a week of training cost that
 * per click. The athlete asked for saves to write and stop, and for this. The
 * count comes from the server (`pending.ts`), which compares each manifest's
 * hash against what the last publish recorded, so it is right after a hand
 * edit or a hand-run publish too.
 *
 * THE GRADER'S REFUSALS ARE SAID HERE, BY WEEK. `publish.py` is still the deep
 * validator; a manifest it refused STAYS WRITTEN, and with saves no longer
 * grading, this is the first moment anybody finds out. A refusal names the
 * week, because a regrade can cover several.
 *
 * LAID OUT LIKE `SaveBar`: banners are full-width blocks above, and the status
 * sits beside a fixed-label button at the right margin. It is `.save`, the
 * filled accent, because it is the control that WRITES -- the published tree.
 *
 * DISABLED IN THE DEMO with the reason in its tooltip, the standing rule for
 * every authoring control; and disabled with nothing pending, where pressing
 * it would spend fourteen seconds to change nothing.
 */
export function RegradeButton({
  pending,
  onDone,
  disabled = STATIC_DATA,
  fetcher,
}: {
  /** Every pending week, sorted -- not only the window's. */
  pending: string[];
  /** Called after a regrade that ran, refused weeks or not: the published
   *  tree moved either way, so the page re-reads it. Not after a failure. */
  onDone: () => void;
  /** Defaults to the build-time constant; a prop so the demo branch is
   *  testable without reloading the module registry. */
  disabled?: boolean;
  /** Injected for tests -- the `useManifestEditor` rule. */
  fetcher?: typeof fetch;
}) {
  const { saving, regrade } = useManifestEditor(fetcher);
  const [outcome, setOutcome] = useState<RegradeOutcome | null>(null);
  const refused = refusedWeeks(outcome);
  const count = pending.length;

  const run = async () => {
    const got = await regrade();
    setOutcome(got);
    if (got.ok) onDone();
  };

  return (
    <div className="edit-savebar regrade-bar">
      {outcome && !outcome.ok ? (
        <div className="banner stop">
          <b>The regrade did not finish. </b>
          {outcome.message}
          {outcome.stderr ? <pre>{outcome.stderr}</pre> : null}
        </div>
      ) : null}

      {refused.length ? (
        <div className="banner stop">
          <b>
            The grader refused {refused.length === 1 ? "a week" : `${refused.length} weeks`}.{" "}
          </b>
          The plans are written; fix them and regrade.
          <ul>
            {refused.map((w) => (
              <li key={w.week_start}>
                Week of {shortDate(w.week_start)}: {w.errors.join(" ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="edit-saverow">
        {saving ? (
          <p className="muted">
            Grading {count === 1 ? "1 week" : `${count} weeks`}… this takes
            about 15 seconds.
          </p>
        ) : outcome?.ok && !refused.length ? (
          <p className="muted">Regraded in {outcome.seconds}s.</p>
        ) : count ? (
          <p className="muted">
            {count === 1 ? "1 week has" : `${count} weeks have`} changes not
            yet graded.
          </p>
        ) : null}

        <button
          type="button"
          className="save"
          title={
            disabled
              ? "The demo is read-only -- weeks are graded in the private app"
              : count
                ? `Grade ${pending.map(shortDate).join(", ")}`
                : "Every week is graded"
          }
          disabled={disabled || saving || !count}
          onClick={run}
        >
          Regrade
        </button>
      </div>
    </div>
  );
}
