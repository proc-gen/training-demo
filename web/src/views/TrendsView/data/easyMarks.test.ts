/* The continuous runs, asserted against the committed `published/` tree plus
 * synthetic edges. Counts are derived and floor-compared, never pinned -- the
 * record grows by several easy runs a week, and a pinned count is a number
 * nobody re-derives.
 */

import { describe, expect, it } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";
import { EASY_ROLES, easyMarks } from "./easyMarks";

const P = PUBLISHED;
const marks = P ? easyMarks(P) : [];

/** Every completed run in the tree, whatever its role. */
const results = () =>
  weekKeys(P!).flatMap((k) => P!.weeks[k]?.adherence?.results ?? []);

describe("easyMarks over the committed tree", () => {
  has(P)("finds every completed easy, recovery and long run, oldest week first", () => {
    // 428 on the record today; a floor, because the athlete keeps running.
    expect(marks.length).toBeGreaterThanOrEqual(400);
    const dates = marks.map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });

  has(P)("takes ALL THREE ROLES and NOTHING ELSE, both directions", () => {
    /* Both directions, the `EMPHASIS_BY_ROLE` precedent: a role that stopped
       being emitted would leave this passing on a smaller corpus, and a role
       that started being emitted would go unnoticed. `volume_only` is the one
       most likely to creep in -- 139 rows of a workout's separately-recorded
       warmup, which is real running that was never prescribed a pace. */
    const seen = new Set(marks.map((m) => m.role));
    expect([...seen].sort()).toEqual([...EASY_ROLES].sort());

    const dropped = new Set(
      results()
        .filter((r) => !(EASY_ROLES as readonly string[]).includes(r.role ?? ""))
        .map((r) => r.role),
    );
    expect(dropped).toContain("volume_only");
    expect(dropped).toContain("subt");
    expect(dropped).toContain("race");
    const marked = new Set(marks.map((m) => `${m.date}|${m.role}`));
    for (const r of results()) {
      if ((EASY_ROLES as readonly string[]).includes(r.role ?? "")) continue;
      expect(marked.has(`${r.date}|${r.role}`)).toBe(false);
    }
  });

  has(P)("prices every mark at the run's OWN average pace", () => {
    /* The number the Week tab's runs table shows for the same run -- the
       plot, the table and the score describing one thing. Nothing here
       re-derives a pace from seconds and miles; that would be a second
       definition of the quantity. */
    const by = new Map(
      results()
        .filter((r) => (EASY_ROLES as readonly string[]).includes(r.role ?? ""))
        .map((r) => [`${r.date}|${r.key}`, r]),
    );
    expect(by.size).toBeGreaterThanOrEqual(marks.length);
    for (const m of marks) {
      expect(Number.isFinite(m.value) && m.value > 0).toBe(true);
      if (m.miles !== null) expect(Number.isFinite(m.miles) && m.miles > 0).toBe(true);
    }
    const paces = new Set(
      results()
        .filter((r) => (EASY_ROLES as readonly string[]).includes(r.role ?? ""))
        .map((r) => r.pace),
    );
    for (const m of marks) expect(paces.has(m.value)).toBe(true);
  });

  has(P)("NAMES THE BELT where the grader declared it, and nowhere else", () => {
    /* 36 runs in the Dec-Mar treadmill block take their distance and pace from
       the declared belt speed; an unlabelled dot would claim the watch measured
       it. Derived from the record rather than listed.

       COUNTED OVER THE EASY-ROLE RUNS, not over the date. A treadmill Tuesday
       is a declared sub-T workout AND an undeclared warmup on one date, so a
       set of dates would demand `belt` on a run the grader never declared. */
    const easy = results().filter((r) =>
      (EASY_ROLES as readonly string[]).includes(r.role ?? ""),
    );
    const declared = easy.filter((r) => r.distance_source === "treadmill-declared");
    expect(declared.length).toBeGreaterThan(0);
    expect(marks.filter((m) => m.belt).length).toBe(declared.length);
    const dates = new Set(declared.map((r) => r.date));
    for (const m of marks) {
      if (m.belt) expect(dates.has(m.date)).toBe(true);
    }
  });

  has(P)("takes every mark from a MEASURED result, never from the plan", () => {
    const measured = new Set(results().map((r) => r.date ?? ""));
    for (const m of marks) expect(measured.has(m.date)).toBe(true);
  });
});

describe("easyMarks edges", () => {
  const payload = (results: unknown[]): Payload =>
    ({
      weeks: {
        "2026-07-13": { week_start: "2026-07-13", adherence: { results } },
      },
    }) as never;

  const run = (over: Record<string, unknown>) => ({
    date: "2026-07-14",
    role: "easy",
    pace: 512.4,
    miles: 6.24,
    ...over,
  });

  it("keeps an easy, a recovery and a long run", () => {
    const got = easyMarks(
      payload([
        run({}),
        run({ date: "2026-07-15", role: "recovery" }),
        run({ date: "2026-07-18", role: "long", miles: 12.42 }),
      ]),
    );
    expect(got.map((m) => m.role)).toEqual(["easy", "recovery", "long"]);
    expect(got.map((m) => m.value)).toEqual([512.4, 512.4, 512.4]);
  });

  it("DROPS EVERY OTHER ROLE, including a workout's own warmup", () => {
    const other = ["volume_only", "subt", "race", "tempo", "progression", "walk"];
    expect(easyMarks(payload(other.map((role) => run({ role }))))).toEqual([]);
  });

  it("REFUSES a zero, negative or missing pace rather than plotting it", () => {
    // `0` is falsy AND not a pace -- the test is on finite positive, never
    // truthiness. A run that covered no distance publishes `pace: null`.
    const bad = [
      run({ pace: 0 }),
      run({ pace: -1 }),
      run({ pace: null }),
      run({ pace: "8:32" }),
    ];
    expect(easyMarks(payload(bad))).toEqual([]);
  });

  it("nulls a distance it cannot trust and keeps the mark", () => {
    const got = easyMarks(payload([run({ miles: 0 }), run({ miles: null })]));
    expect(got).toHaveLength(2);
    expect(got.every((m) => m.miles === null)).toBe(true);
  });

  it("skips a row with no date", () => {
    expect(easyMarks(payload([run({ date: undefined })]))).toEqual([]);
  });

  it("flags the belt ONLY on a treadmill-declared distance", () => {
    const got = easyMarks(
      payload([
        run({ distance_source: "treadmill-declared" }),
        run({ date: "2026-07-15", distance_source: "file" }),
        run({ date: "2026-07-16" }),
      ]),
    );
    expect(got.map((m) => m.belt)).toEqual([true, false, false]);
  });

  it("never reads the planned list", () => {
    const p = {
      weeks: {
        "2026-09-07": {
          week_start: "2026-09-07",
          adherence: {
            results: [],
            planned: [{ date: "2026-09-08", role: "easy", pace: 512.4, miles: 6.2 }],
          },
        },
      },
    } as never;
    expect(easyMarks(p)).toEqual([]);
  });
});
