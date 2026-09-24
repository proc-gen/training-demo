import { describe, expect, it } from "vitest";

import {
  DAY_ROLE_LABELS,
  DEVIATION_REASON_LABELS,
  FLOAT_MODE_LABELS,
  labelOf,
  REP_BAND_LABELS,
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_TIERS,
  SET_MODE_LABELS,
  roleLabel,
} from "./labels";
import { ROLES, SET_MODES, WEEK_TYPES } from "./vocab";

/* BOTH DIRECTIONS, EVERY VOCABULARY -- the `EMPHASIS_BY_ROLE` precedent.
 *
 * One direction alone is worth little here. A token with no label renders as
 * its raw spelling, which is the state this whole file exists to end; a label
 * for a token nothing produces is a vocabulary that has rotted, which is worse
 * because it reads as coverage. */
const MAPS: [string, Record<string, string>, readonly string[]][] = [
  ["roles", ROLE_LABELS, ROLES],
  ["set modes", SET_MODE_LABELS, SET_MODES],
  ["float modes", FLOAT_MODE_LABELS, ["walk", "standing", "jog"]],
  ["rep bands", REP_BAND_LABELS,
   ["rep_1min", "rep_3min", "rep_6min", "rep_10min", "rep_15min"]],
  ["deviation reasons", DEVIATION_REASON_LABELS,
   ["illness", "injury", "conditions", "fatigue", "poor sleep/nutrition",
    "HR spike", "ran long", "bonus mile", "added quality",
    "weekly-budget compensation"]],
];

describe("every vocabulary is fully labelled", () => {
  it.each(MAPS)("%s: every token has a label", (_name, map, tokens) => {
    expect(Object.keys(map).sort()).toEqual([...tokens].sort());
  });

  it.each(MAPS)("%s: no label is a raw token", (_name, map) => {
    for (const [token, label] of Object.entries(map)) {
      expect(label, `${token} is unlabelled`).not.toBe("");
      expect(label, `${token}'s label keeps an underscore`).not.toContain("_");
    }
  });

  it.each(MAPS)("%s: no two tokens share a label", (_name, map) => {
    const labels = Object.values(map);
    expect(new Set(labels).size, `duplicate labels in ${labels}`).toBe(
      labels.length,
    );
  });

  /* The two that a mechanical title-case would get WRONG while looking right,
   * which is the whole argument for a hand-written map. Pinned by value so
   * "improving" the map into a transform fails here rather than on the page. */
  it("spells the ones a transform would mangle", () => {
    expect(ROLE_LABELS.subt).toBe("Sub-T");
    expect(ROLE_LABELS.vo2max).toBe("VO2max");
    expect(SET_MODE_LABELS.subt).toBe("Sub-T");
    expect(SET_MODE_LABELS.vo2max).toBe("VO2max");
  });

  /* WEEK_TYPES has no map ON PURPOSE -- see the note at the foot of labels.ts.
   * This is the guard that makes that choice safe rather than an oversight. */
  it("week types need no map, and this is what keeps that true", () => {
    for (const t of WEEK_TYPES) {
      expect(t).not.toContain("_");
      expect(t[0]).toBe(t[0].toUpperCase());
    }
  });
});

describe("the role tiers", () => {
  it("place every role exactly once", () => {
    const placed = ROLE_TIERS.flatMap((t) => t.roles);
    expect(new Set(placed).size, "a role sits in two tiers").toBe(placed.length);
    expect([...placed].sort()).toEqual([...ROLES].sort());
  });

  it("name no role the vocabulary does not have", () => {
    for (const { tier, roles } of ROLE_TIERS) {
      for (const r of roles) {
        expect(ROLES as readonly string[], `${tier} names ${r}`).toContain(r);
      }
    }
  });

  it("declare no empty tier", () => {
    for (const { tier, roles } of ROLE_TIERS) {
      expect(roles.length, `${tier} is empty`).toBeGreaterThan(0);
    }
  });

  it("carry a distinct, label-shaped heading each", () => {
    const names = ROLE_TIERS.map((t) => t.tier);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).not.toContain("_");
  });

  it("flatten to ROLE_ORDER, which is the editor's order", () => {
    expect(ROLE_ORDER).toEqual(ROLE_TIERS.flatMap((t) => t.roles));
    expect(ROLE_ORDER.length).toBe(ROLES.length);
  });

  /* THE ATHLETE'S TWO EXPLICIT PLACEMENTS (2026-09-12), pinned because they
   * were corrections to a draft rather than anything derivable. */
  it("put hill repeats in Speed and leave neuromuscular alone", () => {
    const speed = ROLE_TIERS.find((t) => t.tier === "Speed");
    expect(speed?.roles).toContain("hill_repeats");
    const neuro = ROLE_TIERS.find((t) => t.tier === "Neuromuscular");
    expect(neuro?.roles).toEqual(["neuromuscular"]);
  });

  it("run lowest intensity first", () => {
    const names = ROLE_TIERS.map((t) => t.tier);
    expect(names[0]).toBe("Support");
    expect(names.indexOf("Aerobic")).toBeLessThan(names.indexOf("Threshold"));
    expect(names.indexOf("Threshold")).toBeLessThan(names.indexOf("Speed"));
    expect(names.indexOf("Speed")).toBeLessThan(names.indexOf("Maximal"));
  });
});

describe("labelOf", () => {
  it("returns the label for a known token", () => {
    expect(roleLabel("hill_repeats")).toBe("Hill Repeats");
    expect(labelOf(SET_MODE_LABELS, "goal_pace")).toBe("Goal Pace");
  });

  /* AN UNKNOWN TOKEN IS SHOWN, NEVER DROPPED -- the `FLAG_COMPONENT` rule. A
   * blank cell would read as a run with no role rather than as one this build
   * cannot name. */
  it("shows an unknown token rather than blanking it", () => {
    expect(roleLabel("fartlek")).toBe("fartlek");
    expect(labelOf(ROLE_LABELS, "volume_only")).toBe("volume_only");
  });

  it("returns the empty string for an absent token", () => {
    expect(roleLabel(undefined)).toBe("");
    expect(roleLabel(null)).toBe("");
    expect(roleLabel("")).toBe("");
  });

  it("labels a DAY role, which is a different vocabulary", () => {
    expect(DAY_ROLE_LABELS.rest).toBe("Rest");
    expect(DAY_ROLE_LABELS.subt).toBe(ROLE_LABELS.subt);
  });
});
