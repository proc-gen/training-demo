import { describe, expect, it } from "vitest";

import type { Adherence, RunResult, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { dayBreaks, prescriptionByKey, sortedRuns } from "./runs";

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

const adherence = (
  results: Partial<RunResult>[],
  planned: Partial<RunResult>[] = [],
): Adherence => ({ results, planned, flags: [] }) as unknown as Adherence;

describe("sortedRuns", () => {
  it("orders by date", () => {
    const a = adherence([
      run({ key: "a", date: "2026-07-30", ordinal: 0 }),
      run({ key: "b", date: "2026-07-27", ordinal: 0 }),
    ]);
    expect(sortedRuns(a).map((r) => r.date)).toEqual([
      "2026-07-27",
      "2026-07-30",
    ]);
  });

  it("orders a double by ORDINAL, which is manifest order", () => {
    /* It sorted on `Number(x.id)` until 2026-08-12 -- Runalyze ids rise with
     * time, so it worked, but it is an accident of the source and a PLANNED run
     * has no id at all. The ids here run backwards against the ordinals, so a
     * sort still keyed on them would come out reversed. */
    const a = adherence([
      run({ key: "pm", runalyze_id: 11, date: "2026-07-27", ordinal: 1 }),
      run({ key: "am", runalyze_id: 20, date: "2026-07-27", ordinal: 0 }),
    ]);
    expect(sortedRuns(a).map((r) => r.key)).toEqual(["am", "pm"]);
  });

  it("MERGES THE PLANNED RUNS IN, in week order", () => {
    /* The grader keeps them in two lists so a planned run cannot reach a
     * measurement. That is a scoring concern; the athlete plans a week and then
     * runs it, so the table shows one week. */
    const a = adherence(
      [
        run({ key: "mon", date: "2026-08-10", ordinal: 0 }),
        run({ key: "wed", date: "2026-08-12", ordinal: 0 }),
      ],
      [
        run({ key: "tue", date: "2026-08-11", ordinal: 0, status: "planned" }),
        run({ key: "fri", date: "2026-08-14", ordinal: 0, status: "planned" }),
      ],
    );
    expect(sortedRuns(a).map((r) => r.key)).toEqual(["mon", "tue", "wed", "fri"]);
  });

  it("interleaves a planned run with a completed one on the SAME date", () => {
    const a = adherence(
      [run({ key: "am", date: "2026-08-14", ordinal: 0 })],
      [run({ key: "pm", date: "2026-08-14", ordinal: 1, status: "planned" })],
    );
    expect(sortedRuns(a).map((r) => r.key)).toEqual(["am", "pm"]);
  });

  it("does not mutate either of the grader's arrays", () => {
    const a = adherence(
      [
        run({ key: "b", date: "2026-07-30", ordinal: 0 }),
        run({ key: "a", date: "2026-07-27", ordinal: 0 }),
      ],
      [run({ key: "p", date: "2026-07-28", ordinal: 0 })],
    );
    const before = a.results.map((r) => r.key);
    const beforePlanned = a.planned.map((r) => r.key);
    sortedRuns(a);
    expect(a.results.map((r) => r.key)).toEqual(before);
    expect(a.planned.map((r) => r.key)).toEqual(beforePlanned);
  });

  it("puts a dateless run first rather than dropping it", () => {
    const a = adherence([
      run({ key: "a", date: "2026-07-27", ordinal: 0 }),
      run({ key: "b", ordinal: 0 }),
    ]);
    expect(sortedRuns(a)).toHaveLength(2);
  });

  it("treats a missing ordinal as 0 rather than NaN", () => {
    /* NaN comparisons are always false, so a single undefined ordinal would
     * leave the order of that date unspecified. A record published before
     * 2026-08-12 carries none. */
    const a = adherence([
      run({ key: "b", date: "2026-07-27", ordinal: 1 }),
      run({ key: "a", date: "2026-07-27" }),
    ]);
    expect(sortedRuns(a).map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("is empty for no runs", () => {
    expect(sortedRuns(adherence([]))).toEqual([]);
  });

  it("returns every run the week holds, on the real payload", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      expect(sortedRuns(w.adherence)).toHaveLength(
        w.adherence.results.length + w.adherence.planned.length,
      );
    }
  });
});

describe("dayBreaks", () => {
  it("marks only the first run of each date", () => {
    /* Tue 8/4 printed four times reads as four separate days until the eye
     * catches the repetition. */
    const runs = [
      run({ key: "1", date: "2026-08-03" }),
      run({ key: "2", date: "2026-08-04" }),
      run({ key: "3", date: "2026-08-04" }),
      run({ key: "4", date: "2026-08-04" }),
      run({ key: "5", date: "2026-08-05" }),
    ];
    // Run 2 is the FIRST of 8/4, so it breaks; runs 3 and 4 repeat it.
    expect(dayBreaks(runs)).toEqual([true, true, false, false, true]);
  });

  it("marks the only run of a one-run week", () => {
    expect(dayBreaks([run({ key: "1", date: "2026-08-03" })])).toEqual([true]);
  });

  it("is empty for no runs", () => {
    expect(dayBreaks([])).toEqual([]);
  });

  it("marks every row when no two dates repeat", () => {
    const runs = ["2026-08-03", "2026-08-04", "2026-08-05"].map((date, i) =>
      run({ key: String(i), date }),
    );
    expect(dayBreaks(runs)).toEqual([true, true, true]);
  });

  it("treats a missing date as its own value rather than throwing", () => {
    const runs = [run({ key: "1" }), run({ key: "2" }), run({ key: "3", date: "x" })];
    expect(dayBreaks(runs)).toEqual([true, false, true]);
  });

  it("RETURNS ONE ENTRY PER RUN, so it can be indexed alongside them", () => {
    const runs = [1, 2, 3, 4].map((i) => run({ key: String(i), date: "2026-08-04" }));
    expect(dayBreaks(runs)).toHaveLength(runs.length);
  });

  it("depends on the order, which is why it lives beside sortedRuns", () => {
    // Unsorted input marks a break every time the date changes, which is most
    // rows -- the reason this is documented as order-dependent.
    const runs = [
      run({ key: "1", date: "2026-08-04" }),
      run({ key: "2", date: "2026-08-03" }),
      run({ key: "3", date: "2026-08-04" }),
    ];
    expect(dayBreaks(runs)).toEqual([true, true, true]);
  });

  it("agrees with sortedRuns on the real payload", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      const runs = sortedRuns(w.adherence);
      const breaks = dayBreaks(runs);
      expect(breaks).toHaveLength(runs.length);
      const shown = runs.filter((_, i) => breaks[i]).map((r) => r.date);
      expect(new Set(shown).size).toBe(shown.length);
    }
  });
});

describe("prescriptionByKey", () => {
  const week = (runs: unknown[]): Week =>
    ({ manifest: { runs } }) as unknown as Week;

  it("maps OUR run key to what the plan asked for", () => {
    /* Keyed on `key` rather than the Runalyze id, which is what makes it work
     * for a planned run at all: the manifest row exists before any activity
     * does, so an id-keyed lookup would find nothing for exactly the rows whose
     * only content IS the prescription. */
    const m = prescriptionByKey(
      week([{ key: "2026-08-14-pm", prescribed: "PM: 2x10:00 at Sub-T" }]),
    );
    expect(m.get("2026-08-14-pm")).toBe("PM: 2x10:00 at Sub-T");
  });

  it("finds a planned run, which carries no runalyze_id", () => {
    const m = prescriptionByKey(
      week([{ key: "2026-08-14-pm", runalyze_id: null, prescribed: "2x10:00" }]),
    );
    expect(m.get("2026-08-14-pm")).toBe("2x10:00");
  });

  it("is empty when the manifest names no runs", () => {
    expect(prescriptionByKey({} as Week).size).toBe(0);
    expect(prescriptionByKey({ manifest: {} } as Week).size).toBe(0);
  });

  it("maps a run with no prescription to an empty string, not undefined", () => {
    // The caller falls back to the grader's own string, and `?? ""` there would
    // hide the difference between "absent from the manifest" and "stated blank".
    const m = prescriptionByKey(week([{ key: "k" }]));
    expect(m.get("k")).toBe("");
    expect(m.has("k")).toBe(true);
  });

  it("skips a keyless row rather than mapping undefined", () => {
    /* A manifest with no `key` fails in the grader long before here, but a
     * stale record predating 2026-08-12 carries `id` instead -- and a
     * `Map<undefined, ...>` entry would then shadow every other keyless row. */
    expect(prescriptionByKey(week([{ id: 42, prescribed: "x" }])).size).toBe(0);
  });

  it("covers every run of every real week", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      const m = prescriptionByKey(w);
      for (const r of sortedRuns(w.adherence)) {
        expect(m.has(r.key!), `${r.date} ${r.key}`).toBe(true);
      }
    }
  });
});
