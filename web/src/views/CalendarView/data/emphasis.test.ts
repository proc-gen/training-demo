import { describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import {
  EMPHASIS_LABEL,
  EMPHASIS_ORDER,
  dayEmphasis,
  emphasisBackground,
  emphasisClass,
  emphasisPhrase,
  tintVar,
  unmappedEmphasis,
} from "./emphasis";

const run = (...emphasis: string[]): RunResult =>
  ({ emphasis }) as unknown as RunResult;

describe("dayEmphasis", () => {
  it("is empty for an easy day", () => {
    expect(dayEmphasis([run()])).toEqual([]);
  });

  it("is empty for no runs at all", () => {
    expect(dayEmphasis([])).toEqual([]);
  });

  it("UNIONS THE DAY'S RUNS", () => {
    /* A Tuesday with a recovery jog in the morning and reps in the evening is a
     * quality day; the jog must not dilute that. */
    expect(dayEmphasis([run(), run("quality")])).toEqual(["quality"]);
  });

  it("dedupes", () => {
    expect(dayEmphasis([run("quality"), run("quality")])).toEqual(["quality"]);
  });

  it("keeps the PUBLISHED order, not the order it met them", () => {
    // A cell is a gradient with a band per token; bands that swapped places
    // between renders would read as a different day.
    expect(dayEmphasis([run("quality"), run("long")])).toEqual(["long", "quality"]);
    expect(dayEmphasis([run("quality", "race", "long")])).toEqual([
      "long", "race", "quality",
    ]);
  });

  it("reads a record published before the field existed as untinted", () => {
    // Additive: an old record is not wrong about anything, it says nothing.
    expect(dayEmphasis([{} as RunResult])).toEqual([]);
    expect(dayEmphasis([{ emphasis: null } as unknown as RunResult])).toEqual([]);
  });

  it("APPENDS AN UNKNOWN TOKEN RATHER THAN DROPPING IT", () => {
    /* `EMPHASIS_ORDER` is a display order, not a filter. A token added to the
     * grader would otherwise vanish from a page that goes on looking complete
     * -- the `unmappedFlags()` rule, one view over. */
    expect(dayEmphasis([run("quality", "zzz")])).toEqual(["quality", "zzz"]);
  });

  it("sorts the unknown tail, so it is deterministic too", () => {
    expect(dayEmphasis([run("bbb"), run("aaa")])).toEqual(["aaa", "bbb"]);
  });
});

describe("EMPHASIS_LABEL", () => {
  it("names every token in the published vocabulary", () => {
    // A tint nobody can name reads as a day that was checked and found
    // ordinary.
    expect(unmappedEmphasis([...EMPHASIS_ORDER])).toEqual([]);
  });

  it("names nothing the vocabulary does not have", () => {
    // The other direction: a stale label outliving its token.
    expect(Object.keys(EMPHASIS_LABEL).sort()).toEqual([...EMPHASIS_ORDER].sort());
  });

  it("gives every label distinct words", () => {
    const labels = Object.values(EMPHASIS_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("emphasisPhrase", () => {
  it("is empty for an untinted day", () => {
    expect(emphasisPhrase([])).toBe("");
  });

  it("joins the labels", () => {
    expect(emphasisPhrase(["long", "quality"])).toBe("long run · quality work");
  });

  it("prints an unmapped token VERBATIM rather than hiding it", () => {
    expect(emphasisPhrase(["zzz"])).toBe("zzz");
  });
});

describe("emphasisClass", () => {
  it("is empty for an untinted day", () => {
    expect(emphasisClass([])).toBe("");
  });

  it("names one class per token, with a leading space to concatenate", () => {
    expect(emphasisClass(["long", "quality"])).toBe(" emph-long emph-quality");
  });
});

describe("tintVar", () => {
  it("names the variable and nothing else", () => {
    expect(tintVar("long")).toBe("var(--tint-long, var(--surface-1))");
  });

  it("IS THE ONE SPELLING, shared by the cell and the legend chip", () => {
    /* The chips showed the full-strength `--emph-` hue until 2026-08-16, so the
     * key did not match the page. Two spellings of `--tint-` would be the same
     * defect one level down. */
    expect(emphasisBackground(["quality"])).toContain(tintVar("quality"));
  });

  it("falls back to the ordinary cell background", () => {
    // An invalid `var()` with no fallback invalidates the whole declaration and
    // drops the cell to the page colour.
    expect(tintVar("zzz")).toContain("var(--surface-1)");
  });

  it("writes no colour value", () => {
    expect(tintVar("race")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("emphasisBackground", () => {
  it("is undefined for an untinted day, so the stylesheet decides", () => {
    expect(emphasisBackground([])).toBeUndefined();
  });

  it("is a flat tint for one token", () => {
    expect(emphasisBackground(["long"])).toBe(
      "var(--tint-long, var(--surface-1))",
    );
  });

  it("SPLITS A DAY THAT IS TWO THINGS, in equal bands", () => {
    const bg = emphasisBackground(["long", "quality"])!;
    expect(bg).toContain("linear-gradient(135deg");
    expect(bg).toContain("var(--tint-long, var(--surface-1)) 0% 50%");
    expect(bg).toContain("var(--tint-quality, var(--surface-1)) 50% 100%");
  });

  it("generalises past two rather than needing a rule per combination", () => {
    const bg = emphasisBackground(["long", "race", "quality"])!;
    expect(bg).toContain("0% 33.");
    expect(bg).toContain("66.");
    expect(bg.endsWith("100%)")).toBe(true);
  });

  it("WRITES NO COLOUR VALUE, only variable names", () => {
    // `globals.css` is the one copy of the palette; a validated hex must never
    // be transcribed into a second file.
    for (const tokens of [["long"], ["long", "race"], [...EMPHASIS_ORDER]]) {
      expect(emphasisBackground(tokens)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(emphasisBackground(tokens)).not.toMatch(/rgb|hsl|oklch/i);
    }
  });

  it("falls back to the ordinary cell background for an unmapped token", () => {
    /* An invalid `var()` with no fallback invalidates the whole declaration and
     * drops the cell to the page colour. The tint is lost and nothing else is;
     * `emphasisPhrase` still names the token in words. */
    expect(emphasisBackground(["zzz"])).toBe("var(--tint-zzz, var(--surface-1))");
  });
});

describe("over the committed tree", () => {
  const tokens = (): string[] => {
    const seen = new Set<string>();
    for (const w of Object.values(PUBLISHED!.weeks)) {
      const a = w.adherence;
      if (!a) continue;
      for (const r of [...a.results, ...a.planned]) {
        for (const t of r.emphasis ?? []) seen.add(t);
      }
    }
    return [...seen].sort();
  };

  it("every token the graders published has a label", () => {
    if (!PUBLISHED) return;
    expect(unmappedEmphasis(tokens())).toEqual([]);
  });

  it("the vocabulary is not vacuous -- real weeks carry these", () => {
    if (!PUBLISHED) return;
    expect(tokens().length).toBeGreaterThan(0);
  });

  it("no published token falls outside the display order", () => {
    // The other direction. An appended token is visible rather than dropped,
    // but it is still a token nobody classified.
    if (!PUBLISHED) return;
    for (const t of tokens()) expect(EMPHASIS_ORDER).toContain(t);
  });
});
