import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Load } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithLoad } from "@/test/payload";
import { wrap } from "@/test/render";
import { FitnessNote } from "./FitnessNote";

afterEach(cleanup);

const found = PUBLISHED ? weekWithLoad(PUBLISHED) : null;

const load = (fitness: unknown, over: Record<string, unknown> = {}): Load =>
  ({ fitness, ...over }) as unknown as Load;

const FIT = {
  trimp: 485,
  activities: 13,
  ctl: 81,
  atl: 81,
  tsb: 0,
  ctl_converged: true,
  ctl_warmup_days: 126,
  history_days: 188,
  ctl_max_in_series: 84,
  series_span_days: 188,
  stream_share: 1,
};

const text = (l: Load) => wrap(<FitnessNote load={l} />).container.textContent!;

describe("FitnessNote", () => {
  it("states the week's TRIMP total and how many activities made it", () => {
    const t = text(load(FIT));
    expect(t).toContain("485 TRIMP");
    expect(t).toContain("13");
  });

  describe("the tier", () => {
    /* A week priced partly from average heart rate is partly an ESTIMATE, and
     * the estimate understates by roughly 3%. That cannot be a per-day column
     * -- it is a share of the week's load -- which is why this note survived
     * `FitnessTable`'s deletion at all. */

    it("says when the whole week was measured from the stream", () => {
      expect(text(load(FIT))).toContain("measured from the per-second stream");
    });

    it("says HOW MUCH was estimated when some of it was", () => {
      const t = text(load({ ...FIT, stream_share: 0.62 }));
      expect(t).toContain("62% measured");
      expect(t).toContain("estimated from average HR");
    });

    it("says NO HEART RATE rather than implying a measurement", () => {
      expect(text(load({ ...FIT, stream_share: null }))).toContain(
        "no heart rate",
      );
    });
  });

  describe("convergence", () => {
    /* A 42-day exponential average seeded at zero needs ~126 days of history
     * before its value stops being a function of that seed. A reader who sees
     * a bare dash in the CTL column cannot tell a missing measurement from a
     * warm-up still running. */

    it("says how many days short a withheld fitness figure is", () => {
      const t = text(
        load({ ...FIT, ctl_converged: false, history_days: 100 }),
      );
      expect(t).toContain("withheld");
      expect(t).toContain("26 more day(s)");
      expect(t).toContain("Fatigue and TRIMP are unaffected");
    });

    it("does not claim a day count it cannot compute", () => {
      const t = text(
        load({ ...FIT, ctl_converged: false, history_days: null }),
      );
      expect(t).toContain("not enough history yet");
    });

    it("reports the highest fitness in the series once converged", () => {
      const t = text(load(FIT));
      expect(t).toContain("84");
      expect(t).toContain("188 days");
      expect(t).not.toContain("withheld");
    });
  });

  describe("the background estimate", () => {
    it("is reported beside the measurement and LABELLED", () => {
      /* The label is the whole instrument. A nominal walking cadence and a
       * nominal fraction of hr_max printed as a peer of a stream-integrated
       * TRIMP would be a model published as a measurement. */
      const t = text(load(FIT, { bg_trimp: 30.2 }));
      expect(t).toContain("30");
      expect(t).toContain("uncalibrated estimate");
      expect(t).toContain("non-run steps");
    });

    it("says it is kept OUT of the fitness curve", () => {
      // An EWMA never forgets its seed, so this is the property that matters
      // most and the one a reader cannot check for themselves.
      expect(text(load(FIT, { bg_trimp: 30.2 }))).toMatch(/kept out/i);
    });

    it("says nothing at all when no day priced one", () => {
      expect(text(load(FIT))).not.toMatch(/uncalibrated/i);
    });
  });

  it("explains an empty column rather than going blank", () => {
    /* Absence is the signal, and the reason sits beside it -- otherwise a
     * table of dashes reads as a broken build. */
    const t = text(load(null));
    expect(t).toContain("No TRIMP series");
    expect(t).toMatch(/not because the days were unmeasured/);
  });

  has(found)("describes the real week", () => {
    const [, w] = found!;
    const l = w.load!;
    if (!l.fitness) return;
    const t = text(l);
    expect(t).toContain("TRIMP");
    expect(t).toContain(String(l.fitness.activities));
  });
});
