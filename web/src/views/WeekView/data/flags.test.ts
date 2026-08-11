import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

import type { Flag, Week } from "@/lib/data/payload";
import { repoRoot } from "@/lib/repo";
import {
  FLAG_COMPONENT,
  allFlags,
  firedFirst,
  flagCaveats,
  flagsFor,
  unmappedFlags,
} from "./flags";

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

describe("flagCaveats", () => {
  const L = (caveats: unknown[]) => ({ caveats }) as unknown as Week["load"];

  it("keys a flag-named caveat by its token", () => {
    const w = week({
      load: L([{ mark: "??", text: "provisional", flag: "strain-spike" }]),
    });
    expect(flagCaveats(w)).toEqual({ "strain-spike": "provisional" });
  });

  it("ignores caveats that name no flag", () => {
    const w = week({
      load: L([
        { mark: "??", text: "no baseline" },
        { mark: "??", text: "never captured", permanent: true },
      ]),
    });
    expect(flagCaveats(w)).toEqual({});
  });

  it("is empty when the load half did not grade", () => {
    expect(flagCaveats(week({}))).toEqual({});
  });
});

describe("allFlags", () => {
  const A = (flags: Flag[]) => ({ flags }) as unknown as Week["adherence"];
  const L = (flags: Flag[]) => ({ flags }) as unknown as Week["load"];

  it("carries both graders' flags", () => {
    const w = week({ adherence: A([flag("a", "clear")]), load: L([flag("b", "fired")]) });
    expect(allFlags(w).map((f) => f.token)).toEqual(["a", "b"]);
  });

  it("is empty when neither half graded", () => {
    expect(allFlags(week({}))).toEqual([]);
  });
});

describe("flagsFor", () => {
  const A = (flags: Flag[]) => ({ flags }) as unknown as Week["adherence"];
  const L = (flags: Flag[]) => ({ flags }) as unknown as Week["load"];

  it("gives a component only its own flags", () => {
    const w = week({
      adherence: A([flag("consecutive-compromised", "clear")]),
      load: L([flag("sleep-debt", "fired"), flag("hidden-load", "clear")]),
    });
    expect(flagsFor(w, "workout").map((f) => f.token)).toEqual([
      "consecutive-compromised",
    ]);
    expect(flagsFor(w, "readiness").map((f) => f.token)).toEqual(["sleep-debt"]);
    expect(flagsFor(w, "integrity").map((f) => f.token)).toEqual(["hidden-load"]);
  });

  it("gives easy and structure nothing, since 2026-08-10", () => {
    // `pace-creep` was easy's only flag and `no-rest-day` /
    // `quality-share-drift` were structure's. All three were deleted from the
    // grader; the panels say "No flag is evaluated against this score" rather
    // than showing an empty space, which would read as "nothing fired".
    const w = week({
      adherence: A([flag("consecutive-compromised", "clear")]),
      load: L([flag("sleep-debt", "fired")]),
    });
    expect(flagsFor(w, "easy")).toEqual([]);
    expect(flagsFor(w, "structure")).toEqual([]);
  });

  it("puts fired first inside a component", () => {
    const w = week({
      load: L([flag("hidden-load", "clear"), flag("strain-spike", "fired")]),
    });
    expect(flagsFor(w, "integrity").map((f) => f.token)).toEqual([
      "strain-spike",
      "hidden-load",
    ]);
  });

  it("is empty for a component nothing flags", () => {
    const w = week({ adherence: A([flag("consecutive-compromised", "clear")]) });
    expect(flagsFor(w, "structure")).toEqual([]);
  });
});

describe("FLAG_COMPONENT", () => {
  it("never sends an adherence token to a load bar, or the reverse", () => {
    // The two vocabularies are not merged: `monotony` exists in both with
    // different definitions, and the split is what keeps a load footnote off an
    // adherence finding.
    const ADHERENCE = new Set(["easy", "workout", "structure"]);
    const LOAD = new Set(["integrity", "readiness"]);
    for (const c of Object.values(FLAG_COMPONENT))
      expect(ADHERENCE.has(c) || LOAD.has(c)).toBe(true);
  });

  it("maps every token the two graders publish", () => {
    /* THE GUARD THAT MAKES THE FLAGS CARD SAFE TO DELETE. Placement is now what
     * decides visibility, so a grader adding a token would drop it off the page
     * entirely. Read off the committed `published/` tree rather than a fixture,
     * because that tree is regenerated from the graders themselves. */
    const root = repoRoot();
    const weeksDir = path.join(root, "athletes", "micah", "published", "weeks");
    const seen = new Set<string>();
    for (const w of fs.readdirSync(weeksDir))
      for (const half of ["adherence.json", "load.json"]) {
        const f = path.join(weeksDir, w, half);
        if (!fs.existsSync(f)) continue;
        const rec = JSON.parse(fs.readFileSync(f, "utf-8")) as { flags?: Flag[] };
        for (const fl of rec.flags ?? []) seen.add(fl.token);
      }
    expect(seen.size).toBeGreaterThan(0);
    const unmapped = [...seen].filter((t) => !FLAG_COMPONENT[t]).sort();
    expect(unmapped).toEqual([]);
  });

  it("names no token neither grader publishes", () => {
    // Both directions, so the map can neither go stale nor grow silently.
    const root = repoRoot();
    const weeksDir = path.join(root, "athletes", "micah", "published", "weeks");
    const seen = new Set<string>();
    for (const w of fs.readdirSync(weeksDir))
      for (const half of ["adherence.json", "load.json"]) {
        const f = path.join(weeksDir, w, half);
        if (!fs.existsSync(f)) continue;
        const rec = JSON.parse(fs.readFileSync(f, "utf-8")) as { flags?: Flag[] };
        for (const fl of rec.flags ?? []) seen.add(fl.token);
      }
    const stale = Object.keys(FLAG_COMPONENT).filter((t) => !seen.has(t)).sort();
    expect(stale).toEqual([]);
  });
});

describe("unmappedFlags", () => {
  const A = (flags: Flag[]) => ({ flags }) as unknown as Week["adherence"];

  it("catches a token no component claims", () => {
    // A flag nobody sees is worse than no flag: the page reads as though it was
    // checked. These render plainly under the meters instead of vanishing.
    const w = week({ adherence: A([flag("brand-new-flag", "fired")]) });
    expect(unmappedFlags(w).map((f) => f.token)).toEqual(["brand-new-flag"]);
  });

  it("is empty when every flag has a home", () => {
    const w = week({ adherence: A([flag("consecutive-compromised", "clear")]) });
    expect(unmappedFlags(w)).toEqual([]);
  });

  it("is empty for every published week", () => {
    const root = repoRoot();
    const weeksDir = path.join(root, "athletes", "micah", "published", "weeks");
    for (const wk of fs.readdirSync(weeksDir)) {
      const read = (half: string) => {
        const f = path.join(weeksDir, wk, half);
        return fs.existsSync(f)
          ? (JSON.parse(fs.readFileSync(f, "utf-8")) as { flags?: Flag[] })
          : null;
      };
      const w = week({
        adherence: read("adherence.json") as unknown as Week["adherence"],
        load: read("load.json") as unknown as Week["load"],
      });
      expect(unmappedFlags(w).map((f) => f.token)).toEqual([]);
    }
  });
});
