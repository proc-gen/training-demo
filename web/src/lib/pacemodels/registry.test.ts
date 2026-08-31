/* The registry: the one dispatch point from an anchor to a bound model.
 *
 * Its arithmetic is pinned by the per-model tests and by `tables.test.ts`; what
 * is left here is the WIRING, which the fixture cannot see: that every declared
 * model is reachable, that the seeds are the ones `propose_chart.seed_distances`
 * uses, and that the labels are total over the names. A model reachable from
 * `MODEL_NAMES` and not from `seedState` would be a dropdown option that
 * silently does nothing.
 */

import { describe, expect, it } from "vitest";

import REFERENCE from "@/test/paceModelReference.json";
import { raceSeconds as dgRaceSeconds } from "./danielsGilbert";
import {
  LABELS,
  MODEL_NAMES,
  SEED_DISTANCES,
  seedState,
  seededFrom,
  type ModelName,
} from "./registry";

const LABELS_FROM_MODEL = (
  REFERENCE.constants as { labels: Record<string, string> }
).labels;

describe("the registry", () => {
  it("names the scored model first and the cross-checks after", () => {
    /* Display order, and it is the ONE copy of it now. `PaceRail` carried its
     * own list while the order came off a `sort_keys` record; the models are
     * the app's arithmetic since the port, so their order lives at its source. */
    expect([...MODEL_NAMES]).toEqual([
      "daniels_gilbert",
      "riegel",
      "cameron",
      "critical_speed",
    ]);
  });

  it("labels every name, both directions, and agrees with Python", () => {
    /* `LABELS` must be TOTAL over `MODEL_NAMES` or a model renders as its bare
     * token -- the fallback `modelOrder`'s unknown-token case covers and which
     * the registry should never need. The other direction catches a label left
     * behind by a deleted model. */
    expect(Object.keys(LABELS).sort()).toEqual([...MODEL_NAMES].sort());
    expect(LABELS).toEqual(LABELS_FROM_MODEL);
  });

  it("declares a seed for every name, and the scored model needs none", () => {
    expect(Object.keys(SEED_DISTANCES).sort()).toEqual([...MODEL_NAMES].sort());
    expect(SEED_DISTANCES.daniels_gilbert).toEqual([]);
    /* Critical speed fits TWO parameters and so needs two efforts; the others
     * fit one and take a single 5000 m. `propose_chart.seed_distances` is the
     * same split. */
    expect(SEED_DISTANCES.critical_speed).toEqual([3000, 10000]);
    expect(SEED_DISTANCES.riegel).toEqual([5000]);
    expect(SEED_DISTANCES.cameron).toEqual([5000]);
  });

  it("binds every model at a real anchor", () => {
    for (const name of MODEL_NAMES) {
      const bound = seedState(name, 55.9);
      expect(bound, name).toBeTruthy();
      expect(bound!.raceSeconds(5000), name).toBeGreaterThan(0);
      expect(bound!.paceForDuration(3600), name).toBeGreaterThan(0);
    }
  });

  it("seeds a cross-check from the Daniels-Gilbert prediction it names", () => {
    /* THE SEEDING IS THE JOIN between the scored model and a cross-check, and
     * a one-reference model must reproduce its own seed exactly -- which is
     * also why the multi-point fixture cases exist. */
    const seed = dgRaceSeconds(55.9, 5000);
    expect(seedState("riegel", 55.9)!.raceSeconds(5000)).toBeCloseTo(seed, 6);
    expect(seedState("cameron", 55.9)!.raceSeconds(5000)).toBeCloseTo(seed, 6);
  });

  it("describes the seeds it actually used", () => {
    /* Built from `SEED_DISTANCES` rather than written out, so the sentence
     * cannot describe a seed the fit did not use. */
    expect(seededFrom("daniels_gilbert")).toBe(
      "the chart's own effective VO2max",
    );
    expect(seededFrom("riegel")).toBe(
      "the Daniels-Gilbert 5000 m predictions at that VO2max",
    );
    expect(seededFrom("critical_speed")).toBe(
      "the Daniels-Gilbert 3000 m + 10000 m predictions at that VO2max",
    );
  });

  it("returns null rather than throwing when a model cannot be seeded", () => {
    /* `seed_state`'s own `except ValueError: return None`. A cross-check that
     * cannot fit at some anchor is a column the dropdown does not offer, not a
     * page that fails to render. */
    expect(seedState("riegel", 500 as never)).toBeNull();
    expect(seedState("critical_speed", -1 as never)).toBeNull();
    for (const name of MODEL_NAMES) {
      expect(seedState(name as ModelName, 0 as never), name).toBeNull();
    }
  });
});
