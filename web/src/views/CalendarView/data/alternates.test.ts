import { describe, expect, it } from "vitest";

import {
  actualHalf,
  plannedHalf,
  stripToAlternate,
  swapWithAlternate,
  type Json,
} from "./alternates";

/** The athlete's own case: the track session and its time-based stand-in. */
const track = (): Json => ({
  key: "2026-09-08-pm",
  date: "2026-09-08",
  template_id: "subt-2",
  role: "subt",
  reps: 10,
  rep_band: "rep_3min",
  rep_distance_m: 800,
  float_distance_m: 200,
  prescribed: "PM: 10x800m w/ 200m jog at Sub-T",
  alternates: [
    {
      role: "subt",
      reps: 11,
      rep_band: "rep_3min",
      rep_seconds: 180,
      float_seconds: 60,
      prescribed: "11x3:00 w/ 1:00 jog at Sub-T",
    },
  ],
});

describe("the two halves of the arrow record", () => {
  it("splits at the FIRST arrow, and a plain string is both halves", () => {
    expect(plannedHalf("A -> B")).toBe("A");
    expect(actualHalf("A -> B")).toBe("B");
    expect(plannedHalf("A -> B -> C")).toBe("A");
    expect(actualHalf("A -> B -> C")).toBe("B -> C");
    expect(plannedHalf("just a plan")).toBe("just a plan");
    expect(actualHalf("just a plan")).toBe("just a plan");
  });

  it("an absent or empty prescribed stays absent, never an empty string", () => {
    expect(plannedHalf(undefined)).toBeUndefined();
    expect(actualHalf(undefined)).toBeUndefined();
    expect(plannedHalf("")).toBeUndefined();
    expect(actualHalf(42)).toBeUndefined();
  });
});

describe("stripToAlternate", () => {
  it("drops identity, the template link and nested alternates -- nothing else", () => {
    const got = stripToAlternate(track());
    expect(got.key).toBeUndefined();
    expect(got.date).toBeUndefined();
    expect(got.template_id).toBeUndefined();
    expect(got.alternates).toBeUndefined();
    expect(got.role).toBe("subt");
    expect(got.reps).toBe(10);
    expect(got.prescribed).toBe("PM: 10x800m w/ 200m jog at Sub-T");
  });

  it("clones -- editing the strip cannot reach the source", () => {
    const run = track();
    const got = stripToAlternate(run);
    got.reps = 99;
    expect(run.reps).toBe(10);
  });
});

describe("swapWithAlternate", () => {
  it("promotes the alternate's body and composes the arrow record", () => {
    const got = swapWithAlternate(track(), 0);
    expect(got.key).toBe("2026-09-08-pm");
    expect(got.date).toBe("2026-09-08");
    expect(got.role).toBe("subt");
    expect(got.reps).toBe(11);
    expect(got.rep_seconds).toBe(180);
    expect(got.float_seconds).toBe(60);
    /* The distance keys belong to the OLD body and must not linger. */
    expect(got.rep_distance_m).toBeUndefined();
    expect(got.float_distance_m).toBeUndefined();
    expect(got.prescribed).toBe(
      "PM: 10x800m w/ 200m jog at Sub-T -> 11x3:00 w/ 1:00 jog at Sub-T",
    );
  });

  it("files the old body into the slot, with its own plain words", () => {
    const got = swapWithAlternate(track(), 0);
    const filed = (got.alternates as Json[])[0];
    expect(filed.reps).toBe(10);
    expect(filed.rep_distance_m).toBe(800);
    expect(filed.prescribed).toBe("PM: 10x800m w/ 200m jog at Sub-T");
    expect(filed.key).toBeUndefined();
    expect(filed.date).toBeUndefined();
    expect(filed.template_id).toBeUndefined();
  });

  it("deletes template_id -- the run is no longer that template's workout", () => {
    expect("template_id" in swapWithAlternate(track(), 0)).toBe(false);
  });

  it("swapping twice is the identity, and the key order leads with key/date", () => {
    const run = track();
    /* `template_id` is the ONE stated loss, so compare without it. */
    const { template_id: _t, ...rest } = run;
    expect(swapWithAlternate(swapWithAlternate(run, 0), 0)).toEqual(rest);
    expect(Object.keys(swapWithAlternate(run, 0)).slice(0, 2)).toEqual([
      "key",
      "date",
    ]);
  });

  it("the identity holds through a record that already carries arrows", () => {
    /* A run whose prescribed is `"X -> Y"` (a previously recorded deviation)
     * keeps X as the anchor: the swap reads `"X -> Q"`, the filed body keeps
     * "Y" as its own words, and the swap back restores `"X -> Y"` exactly --
     * multi-arrow tails included, because the incoming string is taken whole. */
    const run: Json = {
      key: "k",
      date: "2026-09-08",
      role: "subt",
      prescribed: "X -> Y -> Z",
      alternates: [{ role: "subt", prescribed: "Q" }],
    };
    const once = swapWithAlternate(run, 0);
    expect(once.prescribed).toBe("X -> Q");
    expect((once.alternates as Json[])[0].prescribed).toBe("Y -> Z");
    expect(swapWithAlternate(once, 0)).toEqual(run);
  });

  it("collapses the arrow when both halves are the same words", () => {
    const run: Json = {
      key: "k",
      date: "2026-09-08",
      role: "easy",
      prescribed: "60 min easy",
      alternates: [{ role: "recovery", prescribed: "60 min easy" }],
    };
    expect(swapWithAlternate(run, 0).prescribed).toBe("60 min easy");
  });

  it("keeps the one prescribed that exists when the other side has none", () => {
    const noTarget: Json = {
      key: "k",
      date: "d",
      role: "subt",
      prescribed: "P",
      alternates: [{ role: "subt", reps: 11 }],
    };
    expect(swapWithAlternate(noTarget, 0).prescribed).toBe("P");

    const noBase: Json = {
      key: "k",
      date: "d",
      role: "subt",
      alternates: [{ role: "subt", prescribed: "Q" }],
    };
    expect(swapWithAlternate(noBase, 0).prescribed).toBe("Q");

    const neither: Json = {
      key: "k",
      date: "d",
      role: "subt",
      alternates: [{ role: "subt" }],
    };
    expect("prescribed" in swapWithAlternate(neither, 0)).toBe(false);
  });

  it("touches only the chosen slot in a list of several", () => {
    const run = track();
    (run.alternates as Json[]).push({ role: "easy", prescribed: "50 min easy" });
    const got = swapWithAlternate(run, 0);
    expect((got.alternates as Json[])[1]).toEqual({
      role: "easy",
      prescribed: "50 min easy",
    });
  });

  it("returns the run unchanged on a bad index, and never mutates its input", () => {
    const run = track();
    const before = JSON.parse(JSON.stringify(run));
    expect(swapWithAlternate(run, 3)).toBe(run);
    swapWithAlternate(run, 0);
    expect(run).toEqual(before);
  });
});
