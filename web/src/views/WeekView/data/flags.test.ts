import { describe, expect, it } from "vitest";

import type { Flag, Week } from "@/lib/data/payload";
import { firedFirst, flagBlocks } from "./flags";

const flag = (token: string, status: string): Flag => ({ token, status, why: "" });

const week = (over: Partial<Week>): Week => over as Week;

describe("firedFirst", () => {
  it("puts fired flags before everything else", () => {
    // A flag that fired is the reason to read the card.
    const out = firedFirst([
      flag("a", "clear"),
      flag("b", "fired"),
      flag("c", "not-evaluable"),
      flag("d", "fired"),
    ]);
    expect(out.map((f) => f.token)).toEqual(["b", "d", "a", "c"]);
  });

  it("is stable within each group", () => {
    const out = firedFirst([
      flag("a", "clear"),
      flag("b", "not-evaluable"),
      flag("c", "clear"),
    ]);
    expect(out.map((f) => f.token)).toEqual(["a", "b", "c"]);
  });

  it("keeps not-evaluable distinct from clear", () => {
    // "Nobody looked" and "we looked and it was fine" are different findings.
    const out = firedFirst([flag("a", "not-evaluable"), flag("b", "clear")]);
    expect(out.map((f) => f.status)).toEqual(["not-evaluable", "clear"]);
  });

  it("loses nothing", () => {
    const flags = ["fired", "clear", "not-evaluable", "fired"].map((s, i) =>
      flag(String(i), s),
    );
    expect(firedFirst(flags)).toHaveLength(4);
  });

  it("is empty for no flags", () => {
    expect(firedFirst([])).toEqual([]);
  });
});

describe("flagBlocks", () => {
  const A = (flags: Flag[]) => ({ flags }) as unknown as Week["adherence"];
  const L = (flags: Flag[]) => ({ flags }) as unknown as Week["load"];

  it("keeps the two skills' flags in separate blocks", () => {
    // A token means something different depending on which model raised it --
    // `monotony` exists in both vocabularies with different definitions.
    const w = week({
      adherence: A([flag("pace-creep", "clear")]),
      load: L([flag("monotony", "fired")]),
    });
    expect(flagBlocks(w).map((b) => b.title)).toEqual(["Adherence", "Load"]);
  });

  it("orders adherence before load", () => {
    const w = week({ adherence: A([flag("x", "clear")]), load: L([flag("y", "clear")]) });
    expect(flagBlocks(w)[0].title).toBe("Adherence");
  });

  it("omits a half that produced no flags", () => {
    // The card's empty state then says nothing was EVALUATED, which is a
    // different statement from "nothing fired".
    const w = week({ adherence: A([]), load: L([flag("y", "fired")]) });
    expect(flagBlocks(w).map((b) => b.title)).toEqual(["Load"]);
  });

  it("is empty when neither half graded", () => {
    expect(flagBlocks(week({}))).toEqual([]);
  });

  it("sorts within each block", () => {
    const w = week({
      adherence: A([flag("a", "clear"), flag("b", "fired")]),
    });
    expect(flagBlocks(w)[0].flags.map((f) => f.token)).toEqual(["b", "a"]);
  });
});
