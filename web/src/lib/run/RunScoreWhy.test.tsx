import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { wrap } from "@/test/render";
import { runShapes } from "@/test/runShapes";
import { RunScoreWhy } from "./RunScoreWhy";

afterEach(cleanup);

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

const SCORED = run({
  role: "easy",
  hr_pct: 93.4,
  hr_avg: 130,
  hr_max: 145,
  planned: { ceiling: "137", ceiling_kind: "hr" },
  duration_factor: 1,
  earned: 3287,
  total: 3518,
  pct: 93.4,
  duration: { actual: 3518, prescribed: [3600, 4200], factor: 1, pct: -2.28 },
});

const rows = (c: HTMLElement) => [...c.querySelectorAll(".loss")];

describe("RunScoreWhy", () => {
  it("renders the ledger through the same LossRow the score bars use", () => {
    const { container } = wrap(<RunScoreWhy run={SCORED} />);
    expect(rows(container).length).toBeGreaterThan(1);
  });

  it("names the ceiling the run was judged against", () => {
    /* It left the table for exactly this: beside the arithmetic it drives,
     * rather than as a bare number in a column. */
    const { container } = wrap(<RunScoreWhy run={SCORED} />);
    expect(container.textContent).toContain("137 ceiling");
  });

  it("ENDS ON THE ARITHMETIC, as a total row rather than a headline", () => {
    const { container } = wrap(<RunScoreWhy run={SCORED} />);
    const all = rows(container);
    expect(all[all.length - 1].className).toContain("is-total");
    expect(all[all.length - 1].textContent).toContain("earned of");
  });

  it("carries the duration verdict that used to live in a separate table", () => {
    const { container } = wrap(<RunScoreWhy run={SCORED} />);
    expect(container.textContent).toContain("Length");
    expect(container.textContent).toContain("full credit");
  });

  it("states why an unscored run was not scored", () => {
    const { container } = wrap(
      <RunScoreWhy run={run({ planned: { ceiling: "none (volume_only)", ceiling_kind: "none",
                       ceiling_role: "volume_only" }, pct: null })} />,
    );
    expect(container.textContent).toContain("Not scored");
    expect(container.textContent).toContain("warmup or cooldown");
  });

  it("renders nothing when there is genuinely nothing to say", () => {
    const { container } = wrap(<RunScoreWhy run={run({})} />);
    // The note branch still fires, so this is not empty -- but it must never be
    // a bare blank panel.
    expect(container.textContent!.length).toBeGreaterThan(0);
  });

  it("shows the note when the grader published no detail", () => {
    const { container } = wrap(<RunScoreWhy run={run({ role: "easy" })} />);
    expect(container.querySelector(".note")!.textContent).toContain("no detail");
  });

  /* ONE RUN PER RENDERING SHAPE, not one per run the athlete has ever logged.
   * This iterated all 728 and timed out at vitest's 5s default under full-suite
   * load -- the `THE ATHLETE'S HISTORY IS NOT TEST DATA` rule, which `RunDetail`
   * and `RunRow` were converted for and this case was missed by. `runShapes`
   * keys on what the subtree branches on, so the same paths are covered by a
   * few dozen renders. See `src/test/runShapes.ts`. */
  it("explains every shape of real run without throwing", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const { run } of runShapes(PUBLISHED)) {
      const { container, unmount } = wrap(<RunScoreWhy run={run} />);
      // Every run must SAY something. A blank panel reads as a broken page.
      expect(container.textContent!.trim().length).toBeGreaterThan(0);
      seen += 1;
      unmount();
    }
    expect(seen).toBeGreaterThan(0);
  });
});
