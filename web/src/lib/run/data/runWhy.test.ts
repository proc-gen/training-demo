import { describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { prescribedClock, runWhy } from "./runWhy";

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

/** A `planned` block stating one ceiling, as the grader publishes it.
 *
 * THE CEILING MOVED HERE ON 2026-08-29 and the KIND moved with it. These cases
 * used to set `ceiling` at the top level and `unscoredReason` recovered the
 * role by string-matching the display form -- which is the defect the token
 * replaced, so the fixtures have to state the token or they would be asserting
 * against a shape the grader cannot produce.
 */
const planned = (ceiling: string, kind: string, role?: string) =>
  ({ ceiling, ceiling_kind: kind, ceiling_role: role ?? null }) as
    RunResult["planned"];

/** Every sentence the ledger states, INCLUDING the total's.
 *
 * The total is where a lone contributor ends up: a run with one scoring row was
 * stating the same verdict twice -- `subt 100%` as a contributor and `subt 100%`
 * again as the total -- so the arithmetic joins the contributor rather than
 * getting a row of its own. These assertions care that the information is
 * present, not which row carries it. */
const whys = (r: RunResult) => {
  const l = runWhy(r);
  return [...l.rows, ...(l.total ? [l.total] : [])]
    .map((x) => x.why)
    .join(" || ");
};
const labels = (r: RunResult) => {
  const l = runWhy(r);
  return [...l.rows, ...(l.total ? [l.total] : [])].map((x) => x.label);
};

describe("prescribedClock", () => {
  it("collapses an equal pair to one clock", () => {
    // The plan says "30 min", not "30:00-30:00".
    expect(prescribedClock([1800, 1800])).toBe("30:00");
  });

  it("keeps a genuine range", () => {
    expect(prescribedClock([3600, 4200])).toBe("1:00:00–1:10:00");
  });

  it("formats a scalar", () => {
    expect(prescribedClock(1800)).toBe("30:00");
  });

  it.each([null, undefined])("%s is --", (v) => {
    expect(prescribedClock(v)).toBe("--");
  });
});

describe("runWhy: a scored continuous run", () => {
  const easy = run({
    role: "easy",
    hr_pct: 93.4,
    hr_avg: 130,
    hr_max: 145,
    planned: planned("137", "hr"),
    duration_factor: 1,
    earned: 3287,
    total: 3518,
    pct: 93.4,
    duration: { actual: 3518, prescribed: [3600, 4200], factor: 1, pct: -2.28 },
  });

  it("shows the time-at-effort row against the ceiling", () => {
    expect(whys(easy)).toContain("at or below the 137 ceiling");
  });

  it("STATES THE SCORE ONCE, not as a contributor AND a total", () => {
    /* THE DEFECT THE ATHLETE FOUND. A sub-T session showed `subt 100%` as a
     * contributor and `subt 100%` again as the total; an easy run showed
     * `Time at effort 93%` above `easy 93%`. The second row added the
     * arithmetic and nothing else. */
    const l = runWhy(easy);
    const scored = [...l.rows, ...(l.total ? [l.total] : [])].filter(
      (x) => x.pct !== null && x.pct !== undefined,
    );
    expect(scored).toHaveLength(1);
  });

  it("keeps the contributor own label on the merged row", () => {
    // "Time at effort" says more than the role does.
    expect(runWhy(easy).total?.label).toBe("Time at effort");
  });

  it("keeps BOTH rows when the contributor and the run disagree", () => {
    /* There the difference between them IS the information -- a duration factor
     * or an unbanded set is exactly why the run scored less than its work. */
    const r = run({
      ...easy,
      duration_factor: 0.8,
      pct: 74.7,
      duration: { actual: 2400, prescribed: 3600, factor: 0.8, pct: -33 },
    });
    const l = runWhy(r);
    const scored = [...l.rows, ...(l.total ? [l.total] : [])].filter(
      (x) => x.pct !== null && x.pct !== undefined,
    );
    expect(scored.length).toBeGreaterThan(1);
  });

  it("names the ceiling, which left the table for exactly this", () => {
    expect(whys(easy)).toContain("137");
  });

  it("shows the length row with its prescription", () => {
    expect(labels(easy)).toContain("Length");
    expect(whys(easy)).toContain("1:00:00–1:10:00");
  });

  it("ends on the arithmetic as a TOTAL row, not a headline", () => {
    const l = runWhy(easy);
    expect(l.total?.total).toBe(true);
    expect(l.total?.why).toContain("54:47 earned of 58:38 judged");
  });

  it("A DELTA OF EXACTLY 0.0 STILL RENDERS", () => {
    /* It means the run landed exactly inside its prescription -- the best
     * possible outcome, and the one a truthiness filter silently drops. That is
     * the defect the deleted duration table carried for a week. */
    const r = run({
      ...easy,
      duration: { actual: 3600, prescribed: 3600, factor: 1, pct: 0 },
    });
    expect(whys(r)).toContain("0.0%");
  });

  it("reports full credit when the factor is 1", () => {
    expect(runWhy(easy).rows.find((x) => x.key === "duration")?.cost).toBe(
      "full credit",
    );
  });

  it("reports the multiplier when the run was long or short", () => {
    const r = run({
      ...easy,
      duration_factor: 0.87,
      duration: { actual: 2400, prescribed: 3600, factor: 0.87, pct: -33.3 },
    });
    expect(runWhy(r).rows.find((x) => x.key === "duration")?.cost).toBe(
      "credit ×0.87",
    );
  });

  it("carries the forgiveness reason when there is one", () => {
    const r = run({
      ...easy,
      duration_factor: 1,
      duration: { actual: 2400, prescribed: 3600, factor: 1, pct: -33, reason: "illness" },
    });
    expect(whys(r)).toContain("illness");
  });

  it("omits the length row when the plan stated no duration", () => {
    const r = run({ ...easy, duration: null });
    expect(labels(r)).not.toContain("Length");
  });

  describe("a run prescribed in MILES instead", () => {
    const byMiles = () =>
      run({
        ...easy,
        duration: null,
        duration_factor: 0.87,
        distance: { actual: 6.21, prescribed: 5.5, factor: 0.87, pct: 12.9 },
      });

    it("shows a Distance row with both numbers and the applied credit", () => {
      const l = runWhy(byMiles());
      expect(labels(byMiles())).toContain("Distance");
      const d = l.rows.find((x) => x.key === "distance")!;
      expect(d.why).toContain("6.21 mi ran of 5.50 mi");
      expect(d.why).toContain("+12.9%");
      expect(d.cost).toBe("credit ×0.87");
    });

    it("collapses a [lo, lo] range and keeps a real one", () => {
      const one = run({
        ...easy,
        duration: null,
        distance: { actual: 5.0, prescribed: [5, 5], factor: 1, pct: 0 },
      });
      expect(whys(one)).toContain("of 5.00 mi");
      const range = run({
        ...easy,
        duration: null,
        distance: { actual: 5.5, prescribed: [5, 6], factor: 1, pct: 0 },
      });
      expect(whys(range)).toContain("of 5.00–6.00 mi");
    });

    it("shows BOTH rows when the plan stated both, and only one bears a cost", () => {
      /* Time wins where a run states both, so the distance is described with
       * a null factor -- and printing `full credit` on a row that plainly
       * missed its prescription would say the run was the length it was meant
       * to be. */
      const r = run({
        ...easy,
        duration_factor: 1,
        duration: { actual: 3600, prescribed: 3600, factor: 1, pct: 0 },
        distance: { actual: 6.21, prescribed: 5.5, factor: null, pct: 12.9 },
      });
      const l = runWhy(r);
      expect(l.rows.map((x) => x.key)).toEqual(
        expect.arrayContaining(["duration", "distance"]),
      );
      expect(l.rows.find((x) => x.key === "duration")?.cost).toBe("full credit");
      const d = l.rows.find((x) => x.key === "distance")!;
      expect(d.cost).toBe("reported, not scored");
      expect(d.verdict).toBeNull();
    });

    it("carries the forgiveness reason the way its duration twin does", () => {
      const r = run({
        ...easy,
        duration: null,
        duration_factor: 1,
        distance: { actual: 1.2, prescribed: 13, factor: 1, pct: -90.8,
                    reason: "illness" },
      });
      expect(whys(r)).toContain("illness");
    });
  });
});

describe("runWhy: reported rather than scored", () => {
  it.each([
    ["none", "race", "never scored"],
    ["none", "neuromuscular", "heart rate lags"],
    ["none", "volume_only", "warmup or cooldown"],
    ["none", "walk", "Load tab"],
    ["none", "cross", "Load tab"],
    ["uncalibrated", "tempo", "not calibrated"],
  ])("%s (%s) explains itself", (kind, role, phrase) => {
    const l = runWhy(
      run({ planned: planned(`${kind} (${role})`, kind, role), pct: null }),
    );
    expect(l.total?.why).toContain(phrase);
    expect(l.total?.label).toBe("Not scored");
  });

  it("an UNKNOWN unscored role still explains itself", () => {
    /* `REPORTED_REASON` is keyed on the role and must stay total in effect:
     * a role the map does not know falls through to a generic sentence, never
     * to silence. The `EMPHASIS_LABEL` / `FLAG_COMPONENT` precedent -- a token
     * nobody mapped must still reach the reader. */
    const l = runWhy(
      run({ planned: planned("none (brand_new)", "none", "brand_new"),
            pct: null }),
    );
    expect(l.total?.label).toBe("Not scored");
    expect(l.total?.why).toContain("no criterion is");
  });

  it("A volume_only run is DISTINGUISHABLE from a grader crash", () => {
    /* It fell through every branch and published no ceiling key at all until
     * 2026-08-11, which is exactly what a crash looks like. */
    const l = runWhy(
      run({ planned: planned("none (volume_only)", "none", "volume_only"),
            pct: null }),
    );
    expect(l.total?.why).toContain("scored as part of no session");
  });

  it("says why an uncalibrated ceiling does NOT fall back", () => {
    const l = runWhy(
      run({ planned: planned("uncalibrated (tempo)", "uncalibrated", "tempo"),
            pct: null }),
    );
    expect(l.total?.why).toContain("MEANT to run above");
  });

  describe("the sprint cadence verdict", () => {
    /* REPORTED AND SCORING NOTHING, 2026-09-10. The athlete's criterion: *"as
     * long as at any point in the workout it read over 200 spm, it passes."*
     * Every sentence is composed from `cadence_check`'s four fields, so the
     * record carries the measurement and none of the prose. */
    const sprints = (cadence_check: Record<string, unknown>) =>
      run({
        planned: planned("none (neuromuscular)", "none", "neuromuscular"),
        pct: null,
        cadence_check: cadence_check as RunResult["cadence_check"],
      });
    const cadenceRowOf = (r: RunResult) =>
      runWhy(r).rows.find((x) => x.key === "cadence");

    it("states the peak, the line and that it moves no score", () => {
      const x = cadenceRowOf(sprints({
        verdict: "met", peak_spm: 224, rep_seconds: 6, target_spm: 200,
      }));
      expect(x?.label).toBe("Sprint cadence");
      expect(x?.why).toContain("224 spm");
      expect(x?.why).toContain("over the 200 spm line");
      expect(x?.why).toContain("moves no score");
      expect(x?.verdict).toBe(true);
    });

    it("a miss reads as a miss and still carries the line", () => {
      const x = cadenceRowOf(sprints({
        verdict: "not-met", peak_spm: 198, rep_seconds: 6, target_spm: 200,
      }));
      expect(x?.why).toContain("198 spm");
      expect(x?.why).toContain("not over the 200 spm line");
      expect(x?.verdict).toBe(false);
    });

    it("NOT-EVALUABLE IS NOT A FAILURE, and `verdict` must be null", () => {
      /* THE ASYMMETRY THAT DECIDES THIS. A `false` here renders a session the
       * criterion does not apply to as one that FAILED -- and the athlete's
       * whole reason for narrowing the gate was to stop 20-30 second rep
       * sessions being failed for running what was prescribed. A missed pass is
       * a puzzle; a phantom failure is a session somebody tries to fix. */
      const x = cadenceRowOf(sprints({
        verdict: "not-evaluable", peak_spm: 224, rep_seconds: null,
        target_spm: 200,
      }));
      expect(x?.verdict).toBeNull();
      expect(x?.why).toContain("no sprint-length reps");
      expect(x?.why).not.toContain("moves no score");
    });

    it("distinguishes NO CADENCE DATA from NO SPRINT PRESCRIPTION", () => {
      /* One spelling per fact, the `run_step_source` rule. Both are
       * `not-evaluable` and they are different things: a six-second sprint the
       * watch never sampled, versus a session that is not sprint work. */
      const noData = cadenceRowOf(sprints({
        verdict: "not-evaluable", peak_spm: null, rep_seconds: 6,
        target_spm: 200,
      }));
      expect(noData?.why).toContain("no cadence was recorded");
      expect(noData?.why).toContain("no cadence samples");

      const notSprints = cadenceRowOf(sprints({
        verdict: "not-evaluable", peak_spm: 194, rep_seconds: null,
        target_spm: 200,
      }));
      expect(notSprints?.why).toContain("194 spm");
      expect(notSprints?.why).toContain("does not apply");
      expect(noData?.why).not.toBe(notSprints?.why);
    });

    it("NEVER carries a pct, because the verdict scores nothing", () => {
      /* A percentage here would put this row in the same visual language as the
       * rows that do move a score. */
      for (const v of ["met", "not-met", "not-evaluable"]) {
        const x = cadenceRowOf(sprints({
          verdict: v, peak_spm: 224, rep_seconds: 6, target_spm: 200,
        }));
        expect(x?.pct).toBeNull();
        expect(x?.cost).toBeNull();
      }
    });

    it("a run with NO block gets no row at all", () => {
      /* ABSENT, not empty. The question is only put to a sprint session, and a
       * row on an easy run would read as a criterion nobody stated. */
      const l = runWhy(run({
        planned: planned("137", "hr", "easy"), pct: 93.6, hr_pct: 93.6,
      }));
      expect(l.rows.find((x) => x.key === "cadence")).toBeUndefined();
    });

    it("reaches a SCORED run too, which is what the plan needs", () => {
      /* 2026-09-11 and 09-18 pair 4x6s hill sprints with a sub-T block in ONE
       * run. That reaches the scored assembly rather than the reported early
       * return, so the row has to be pushed in both places. */
      const l = runWhy(run({
        pct: 97.9, earned: 1631, total: 1666, role: "mixed",
        detail: { sets: [{ mode: "subt", pct: 97.9 } as never] },
        cadence_check: {
          verdict: "met", peak_spm: 234, rep_seconds: 6, target_spm: 200,
        } as RunResult["cadence_check"],
      }));
      const x = l.rows.find((r) => r.key === "cadence");
      expect(x?.why).toContain("234 spm");
      // And the run's own score is untouched beside it.
      expect(l.total?.why).toContain("earned");
    });

    it("the reported sentence points at the verdict rather than denying it", () => {
      /* `REPORTED_REASON.neuromuscular` said the session is graded by nothing.
       * That is still true of the SCORE and became misleading about the page the
       * moment a verdict appeared above it. */
      const l = runWhy(sprints({
        verdict: "met", peak_spm: 224, rep_seconds: 6, target_spm: 200,
      }));
      expect(l.total?.why).toContain("cadence verdict");
      expect(l.total?.why).toContain("reaches no score");
      expect(l.total?.label).toBe("Not scored");
    });
  });

  it("carries the grader's OWN sentence verbatim when there is one", () => {
    /* The page must never compose its own version of this. */
    const l = runWhy(
      run({ pct: null, detail: { unscorable: "no interval structure detected" } }),
    );
    expect(l.total?.why).toBe("no interval structure detected");
  });

  it("explains a continuous run whose heart-rate stream was unusable", () => {
    const l = runWhy(
      run({
        planned: planned("137", "hr"),
        pct: null,
        detail: { unscorable: "no usable heart-rate stream — reported, not scored" },
      }),
    );
    expect(l.total?.why).toContain("heart-rate stream");
  });

  it("still shows the length row for an unscored run that had a prescription", () => {
    const l = runWhy(
      run({
        planned: planned("none (volume_only)", "none", "volume_only"),
        pct: null,
        duration: { actual: 1000, prescribed: 900, factor: 1, pct: 11.1 },
      }),
    );
    expect(l.rows.map((x) => x.label)).toContain("Length");
  });
});

describe("runWhy: a progression", () => {
  const prog = run({
    role: "progression",
    planned: planned("monotonic", "monotonic"),
    earned: 3,
    total: 3,
    pct: 100,
    detail: {
      progression: [{}, {}, {}],
      monotonic: true,
      pace_spread: 44,
      progression_score: { earned: 3, total: 3, pct: 100 },
    },
  } as unknown as Partial<RunResult>);

  it("judges it on getting faster", () => {
    expect(labels(prog)).toContain("Each segment faster than the last");
  });

  it("passes the verdict through as a tri-state", () => {
    expect(runWhy(prog).rows.find((x) => x.key === "monotonic")?.verdict).toBe(true);
  });

  it("reports the pace spread", () => {
    expect(whys(prog)).toContain("44 sec/mi");
  });

  it("says when a segment count was ASSUMED rather than prescribed", () => {
    const r = run({
      ...prog,
      detail: { ...prog.detail, segments_assumed: 3 },
    } as unknown as Partial<RunResult>);
    expect(whys(r)).toContain("did not state a count");
  });

  it("reports a non-monotonic block as a failure, not as absent", () => {
    const r = run({
      ...prog,
      detail: { ...prog.detail, monotonic: false },
    } as unknown as Partial<RunResult>);
    expect(runWhy(r).rows.find((x) => x.key === "monotonic")?.verdict).toBe(false);
  });

  it("treats an unjudgeable block as neither pass nor fail", () => {
    const r = run({
      ...prog,
      detail: { ...prog.detail, monotonic: null },
    } as unknown as Partial<RunResult>);
    expect(runWhy(r).rows.find((x) => x.key === "monotonic")?.verdict).toBeNull();
  });
});

describe("runWhy: quality sets", () => {
  const set = (over: Record<string, unknown> = {}) =>
    run({
      role: "subt",
      earned: 2000,
      total: 2000,
      pct: 100,
      detail: {
        sets: [
          {
            mode: "subt",
            scored_on: "hr",
            ceiling: "162/166",
            detected_reps: 12,
            prescribed_reps: 12,
            pct: 100,
            rep_rows: [],
            ...over,
          },
        ],
      },
    } as unknown as Partial<RunResult>);

  it("names the criterion the set was judged against", () => {
    expect(whys(set())).toContain("against 162/166");
  });

  it("counts the reps found against the reps prescribed", () => {
    expect(whys(set())).toContain("12 reps of 12 prescribed");
  });

  it("counts the reps that failed, and only the JUDGED ones", () => {
    /* ok === null is not judgeable -- no HR, or a suspect split -- and is not a
     * failure. */
    const r = set({
      rep_rows: [
        { work: true, ok: false },
        { work: true, ok: null },
        { work: true, ok: true },
      ],
    });
    expect(whys(r)).toContain("1 outside it");
  });

  it("SAYS WHEN EVERY JUDGED REP MISSED ON ONE SIDE", () => {
    /* A target mismatch rather than an execution failure. The grader has worked
     * this out all along and it was thrown away before 2026-08-11. */
    const r = set({ scored_on: "pace", off_target: "slow", ceiling: "3000m pace" });
    expect(whys(r)).toContain("slower than the band");
    expect(whys(r)).toContain("target mismatch");
  });

  it("uses the right word for a fast mismatch", () => {
    const r = set({ scored_on: "pace", off_target: "fast" });
    expect(whys(r)).toContain("faster than the band");
  });

  it("reports work the set could not judge", () => {
    const r = set({ unbanded_seconds: 180 });
    expect(whys(r)).toContain("3:00 reported, not scored");
  });

  it("nests each set under the run when there is more than one", () => {
    const two = run({
      role: "mixed",
      earned: 2000,
      total: 2000,
      pct: 100,
      detail: {
        sets: [
          { mode: "subt", scored_on: "hr", ceiling: "162/166", pct: 100, rep_rows: [] },
          { mode: "repetition", scored_on: "pace", ceiling: "3000m pace", pct: 90, rep_rows: [] },
        ],
      },
    } as unknown as Partial<RunResult>);
    expect(runWhy(two).rows.find((x) => x.key === "set-0")?.depth).toBe(1);
  });

  it("reports the recoveries at session level", () => {
    const r = run({
      role: "subt",
      earned: 1,
      total: 1,
      pct: 100,
      detail: { recoveries: 12, recoveries_failed: 12, recovery_failure_pct: 100 },
    } as unknown as Partial<RunResult>);
    expect(whys(r)).toContain("12 of 12 did not bring heart rate down");
  });
});

describe("runWhy: the shape of the ledger", () => {
  it("says so plainly when the grader published no detail", () => {
    expect(runWhy(run({ role: "easy" })).note).toContain("no detail");
  });

  it("has no total row when there is no arithmetic to show", () => {
    expect(runWhy(run({ role: "easy" })).total).toBeNull();
  });

  it("NEVER BRANCHES ON role -- an unknown role still explains itself", () => {
    /* Keying on role would mean copying three role vocabularies into
     * TypeScript, which is the drift score_bucket exists to prevent. */
    const l = runWhy(run({ role: "something-new", hr_pct: 90,
                           planned: planned("137", "hr"),
                           earned: 10, total: 11, pct: 90 }));
    expect(l.total).toBeTruthy();
    expect(l.total!.why).toContain("137 ceiling");
  });

  it("reports a loss on the total row only when there was one", () => {
    const clean = runWhy(run({ hr_pct: 100, earned: 100, total: 100, pct: 100 }));
    expect(clean.total?.cost).toBeNull();
    const lost = runWhy(run({ hr_pct: 50, earned: 50, total: 100, pct: 50 }));
    expect(lost.total?.cost).toBe("0:50 lost");
  });
});

describe("runWhy: against the committed payload", () => {
  it("explains every run of every graded week", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      for (const r of w.adherence.results) {
        const l = runWhy(r);
        seen += 1;
        // Every run must say SOMETHING: rows, a total, or a note explaining the
        // absence. A blank panel reads as a broken page.
        expect(l.rows.length > 0 || l.total !== null || l.note !== null).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("gives every scored run a total row carrying its own score", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      for (const r of w.adherence.results) {
        if (r.pct === null || r.pct === undefined) continue;
        expect(runWhy(r).total?.pct).toBe(r.pct);
      }
    }
  });

  it("gives every UNSCORED run a stated reason", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      for (const r of w.adherence.results) {
        if (r.pct !== null && r.pct !== undefined) continue;
        const l = runWhy(r);
        expect(l.total?.why || l.note).toBeTruthy();
      }
    }
  });
});
