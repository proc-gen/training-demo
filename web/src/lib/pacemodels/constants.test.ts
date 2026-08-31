/* The duplicated method constants, held to the Python model file.
 *
 * `scripts/pace-models/model.json` is the source; these are a sanctioned COPY,
 * the same arrangement `pace_band_pct` already has across three model files.
 * `tests/test_pace_models.py` asserts the two agree from the Python side --
 * that is the check that can see the model file at all. THIS side asserts the
 * copy against the FIXTURE, which is generated from that same model file, so a
 * value edited in one place and not the other fails in both suites rather than
 * only in the one somebody happens to run.
 */

import { describe, expect, it } from "vitest";

import REFERENCE from "@/test/paceModelReference.json";
import { RACE_DISTANCES, TEMPO_DURATIONS_SECONDS } from "./constants";

const FROM_MODEL = REFERENCE.constants as {
  race_distances: Record<string, number>;
  tempo_durations_seconds: number[];
  labels: Record<string, string>;
};

describe("the constants match scripts/pace-models/model.json", () => {
  it("carries the same race distances, both directions", () => {
    /* BOTH DIRECTIONS. A subset check would let this copy go stale as the
     * model file grows a distance; a superset check would let it keep one
     * deleted two months ago. */
    expect(Object.keys(RACE_DISTANCES).sort()).toEqual(
      Object.keys(FROM_MODEL.race_distances).sort(),
    );
    for (const [key, metres] of Object.entries(FROM_MODEL.race_distances)) {
      expect(RACE_DISTANCES[key], key).toBe(metres);
    }
  });

  it("carries the same tempo durations", () => {
    expect([...TEMPO_DURATIONS_SECONDS]).toEqual(
      FROM_MODEL.tempo_durations_seconds,
    );
  });

  it("states the two long distances OFFICIALLY, not as the charts do", () => {
    /* The committed charts were transcribed from calculator runs fed 21.1 and
     * 42.2 km, which sit 0.63 and 1.29 seconds from these. Recorded rather
     * than reconciled -- and a copy that silently rounded them would move
     * every half and full marathon projection. */
    expect(RACE_DISTANCES["21097m"]).toBe(21097.5);
    expect(RACE_DISTANCES["42195m"]).toBe(42195);
  });
});
