import { describe, expect, it } from "vitest";

import {
  otherTrainingDays,
  otherTrainingIn,
  otherTrainingOf,
  withOtherTraining,
} from "./otherTraining";
import { serializeManifest } from "./merge";

const ROUTINE = "Lifting\n  squat 3x5 @ 185\n\nPT\n  clamshells 3x15";

describe("otherTrainingDays", () => {
  it("returns the days map of a well-formed file", () => {
    expect(
      otherTrainingDays({ days: { "2026-10-12": "PT", "2026-10-15": ROUTINE } }),
    ).toEqual({ "2026-10-12": "PT", "2026-10-15": ROUTINE });
  });

  it("ignores everything beside `days`", () => {
    expect(otherTrainingDays({ _comment: "x", days: { "2026-10-12": "PT" } })).toEqual({
      "2026-10-12": "PT",
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "PT"],
    ["a number", 5],
    ["a list", [{ days: {} }]],
    ["an empty object", {}],
    ["days as a list", { days: ["PT"] }],
    ["days as a string", { days: "PT" }],
    ["days as null", { days: null }],
  ])("reads %s as empty", (_n, record) => {
    expect(otherTrainingDays(record)).toEqual({});
  });

  it("drops a non-string or empty entry and keeps its neighbours", () => {
    expect(
      otherTrainingDays({
        days: {
          "2026-10-12": 5,
          "2026-10-13": ["squat"],
          "2026-10-14": null,
          "2026-10-15": "",
          "2026-10-16": "PT",
        },
      }),
    ).toEqual({ "2026-10-16": "PT" });
  });
});

describe("otherTrainingOf", () => {
  const file = { days: { "2026-10-12": ROUTINE } };

  it("returns the date's text verbatim, newlines and indentation intact", () => {
    expect(otherTrainingOf(file, "2026-10-12")).toBe(ROUTINE);
  });

  it("returns '' -- the cleared state -- for a date with none", () => {
    expect(otherTrainingOf(file, "2026-10-13")).toBe("");
  });

  it("returns '' for a malformed file or entry", () => {
    expect(otherTrainingOf(null, "2026-10-12")).toBe("");
    expect(otherTrainingOf({ days: { "2026-10-12": 5 } }, "2026-10-12")).toBe("");
  });
});

describe("withOtherTraining", () => {
  it("creates `days` on an empty or absent file", () => {
    expect(withOtherTraining({ days: {} }, "2026-10-12", "PT")).toEqual({
      days: { "2026-10-12": "PT" },
    });
    expect(withOtherTraining(null, "2026-10-12", "PT")).toEqual({
      days: { "2026-10-12": "PT" },
    });
    expect(withOtherTraining({}, "2026-10-12", "PT")).toEqual({
      days: { "2026-10-12": "PT" },
    });
  });

  it("replaces an existing date and leaves the others alone", () => {
    const file = { days: { "2026-10-12": "squat", "2026-10-15": "PT" } };
    expect(withOtherTraining(file, "2026-10-12", "deadlift")).toEqual({
      days: { "2026-10-12": "deadlift", "2026-10-15": "PT" },
    });
  });

  it("deletes a date on '' and leaves the others alone", () => {
    const file = { days: { "2026-10-12": "squat", "2026-10-15": "PT" } };
    expect(withOtherTraining(file, "2026-10-12", "")).toEqual({
      days: { "2026-10-15": "PT" },
    });
  });

  it("keeps `days` PRESENT-EMPTY when the last entry goes -- the file is never deleted", () => {
    expect(withOtherTraining({ days: { "2026-10-12": "PT" } }, "2026-10-12", "")).toEqual({
      days: {},
    });
  });

  it("clearing a date that has nothing is a structural no-op", () => {
    const file = { days: { "2026-10-15": "PT" } };
    expect(withOtherTraining(file, "2026-10-12", "")).toEqual(file);
  });

  it("keeps every other key in the file verbatim", () => {
    const file = { _comment: "the athlete's", later: [1, 2], days: {} };
    expect(withOtherTraining(file, "2026-10-12", "PT")).toEqual({
      _comment: "the athlete's",
      later: [1, 2],
      days: { "2026-10-12": "PT" },
    });
  });

  it("writes `days` in DATE ORDER whatever order the edits came in", () => {
    let file: unknown = { days: {} };
    for (const d of ["2026-10-15", "2026-10-07", "2026-10-12", "2026-10-10"]) {
      file = withOtherTraining(file, d, `day ${d}`);
    }
    expect(Object.keys((file as { days: object }).days)).toEqual([
      "2026-10-07",
      "2026-10-10",
      "2026-10-12",
      "2026-10-15",
    ]);
  });

  it("keeps a malformed neighbour entry rather than silently deleting it", () => {
    const file = { days: { "2026-10-12": 5 } };
    expect(withOtherTraining(file, "2026-10-15", "PT")).toEqual({
      days: { "2026-10-12": 5, "2026-10-15": "PT" },
    });
  });

  it("does not mutate its input", () => {
    const file = { days: { "2026-10-12": "squat" } };
    const before = JSON.stringify(file);
    withOtherTraining(file, "2026-10-12", "");
    withOtherTraining(file, "2026-10-15", "PT");
    expect(JSON.stringify(file)).toBe(before);
  });

  it("round-trips through the normalized write with its newlines intact", () => {
    const text = serializeManifest(withOtherTraining(null, "2026-10-12", ROUTINE));
    expect(otherTrainingOf(JSON.parse(text), "2026-10-12")).toBe(ROUTINE);
    // Stored as JSON `\n` escapes, one string, never split across keys.
    expect(text).toContain(JSON.stringify(ROUTINE));
  });

  it("set then read is the identity, for every date", () => {
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-18"]) {
      expect(otherTrainingOf(withOtherTraining(null, d, ROUTINE), d)).toBe(ROUTINE);
    }
  });
});

describe("otherTrainingIn", () => {
  const days = {
    "2026-10-11": "the Sunday before",
    "2026-10-12": "Monday",
    "2026-10-18": "Sunday",
    "2026-10-19": "the Monday after",
  };
  const week = [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ];

  it("keeps exactly the dates asked for, both edges included", () => {
    expect(otherTrainingIn(days, week)).toEqual({
      "2026-10-12": "Monday",
      "2026-10-18": "Sunday",
    });
  });

  it("is empty for an empty map or an empty window", () => {
    expect(otherTrainingIn({}, week)).toEqual({});
    expect(otherTrainingIn(days, [])).toEqual({});
  });

  it("takes any iterable, a Set included", () => {
    expect(otherTrainingIn(days, new Set(["2026-10-19"]))).toEqual({
      "2026-10-19": "the Monday after",
    });
  });
});
