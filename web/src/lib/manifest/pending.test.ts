import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readRequiredText } from "../db/records";
import { athleteSlugs } from "../repository";
import { FIXTURE_WEEKS_DIR } from "@/test/fixtureManifests";
import {
  gradedHashes,
  MANIFEST_ALT_KEYS,
  MANIFEST_KEYS,
  MANIFEST_RUN_KEYS,
  NO_PENDING_PLANS,
  pendingPlans,
  pendingWeeks,
  projectManifest,
  windowDates,
  windowStarts,
} from "./pending";
import { addDays, mondayOf } from "../data/weekDates";
import { CALENDAR_WEEKS } from "../query/slices";

describe("pendingWeeks", () => {
  it("is empty when every manifest is the one last graded", () => {
    expect(pendingWeeks({ a: "1", b: "2" }, { a: "1", b: "2" })).toEqual([]);
  });

  it("is empty for an athlete with no manifests", () => {
    expect(pendingWeeks({}, {})).toEqual([]);
    expect(pendingWeeks({}, { a: "1" })).toEqual([]);
  });

  it("names a week whose bytes changed", () => {
    expect(pendingWeeks({ a: "1", b: "X" }, { a: "1", b: "2" })).toEqual(["b"]);
  });

  it("names a week created since the last publish", () => {
    expect(pendingWeeks({ a: "1", b: "2" }, { a: "1" })).toEqual(["b"]);
  });

  it("does not name a week whose manifest is gone -- nothing to grade", () => {
    expect(pendingWeeks({ a: "1" }, { a: "1", gone: "9" })).toEqual([]);
  });

  it("names every week when nothing was ever recorded", () => {
    expect(pendingWeeks({ b: "2", a: "1" }, {})).toEqual(["a", "b"]);
  });

  it("is sorted whatever order the hashes arrive in", () => {
    const current = { "2026-10-19": "x", "2026-10-05": "y", "2026-10-12": "z" };
    expect(pendingWeeks(current, {})).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
  });

  it("compares the whole hash, not a prefix", () => {
    expect(pendingWeeks({ a: "abcd" }, { a: "abc" })).toEqual(["a"]);
  });
});

describe("gradedHashes", () => {
  it("reads the record's weeks map", () => {
    expect(gradedHashes({ weeks: { a: "1", b: "2" } })).toEqual({ a: "1", b: "2" });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "weeks"],
    ["a number", 3],
    ["an array", [1, 2]],
    ["no weeks key", {}],
    ["weeks null", { weeks: null }],
    ["weeks an array", { weeks: ["a"] }],
    ["weeks a string", { weeks: "a" }],
  ])("is empty -- so EVERY week reads pending -- for %s", (_n, record) => {
    expect(gradedHashes(record)).toEqual({});
  });

  it("drops a non-string hash rather than comparing against it", () => {
    expect(gradedHashes({ weeks: { a: "1", b: 2, c: null } })).toEqual({ a: "1" });
  });

  it("composes: a malformed record makes every manifest pending", () => {
    expect(pendingWeeks({ a: "1" }, gradedHashes(null))).toEqual(["a"]);
  });
});

describe("projectManifest", () => {
  it("keeps the four week keys and drops every other", () => {
    expect(
      projectManifest({
        week_start: "2026-10-12",
        week_type: "Volume",
        phase: "Base",
        rest_days: ["2026-10-12"],
        notes: { "2026-10-13": "prose" },
        _comment: "provenance",
        planned_seconds: 100,
      }),
    ).toEqual({
      week_start: "2026-10-12",
      week_type: "Volume",
      phase: "Base",
      rest_days: ["2026-10-12"],
    });
  });

  it("keeps a run's five keys and drops the prescription detail", () => {
    expect(
      projectManifest({
        week_start: "2026-10-12",
        runs: [
          {
            key: "tue",
            date: "2026-10-13",
            role: "easy",
            prescribed: "45 min easy",
            prescribed_seconds: 2700,
            runalyze_id: 1,
            sets: [],
          },
        ],
      }),
    ).toEqual({
      week_start: "2026-10-12",
      runs: [
        { key: "tue", date: "2026-10-13", role: "easy", prescribed: "45 min easy" },
      ],
    });
  });

  it("projects alternates to role and words, keeping an empty one", () => {
    const got = projectManifest({
      runs: [
        {
          key: "a",
          alternates: [
            { role: "easy", prescribed: "30 min", prescribed_seconds: 1800 },
            { notes: "nothing kept" },
            "not an object",
          ],
        },
      ],
    }) as { runs: { alternates: unknown[] }[] };
    expect(got.runs[0].alternates).toEqual([
      { role: "easy", prescribed: "30 min" },
      {},
    ]);
  });

  it("leaves a non-list alternates value as stated", () => {
    expect(projectManifest({ runs: [{ key: "a", alternates: null }] })).toEqual({
      runs: [{ key: "a", alternates: null }],
    });
  });

  it("skips a run that is not an object", () => {
    expect(projectManifest({ runs: [null, "x", 3, [], { key: "a" }] })).toEqual({
      runs: [{ key: "a" }],
    });
  });

  it("states no runs key where the manifest has none", () => {
    expect(projectManifest({ week_start: "2026-10-12" })).toEqual({
      week_start: "2026-10-12",
    });
  });

  it("keeps an empty runs list as an empty list", () => {
    expect(projectManifest({ runs: [] })).toEqual({ runs: [] });
  });

  it("ignores a runs value that is not a list", () => {
    expect(projectManifest({ runs: { a: 1 } })).toEqual({});
  });

  it("passes a non-object through, as the Python does", () => {
    expect(projectManifest(null)).toBe(null);
    expect(projectManifest("x")).toBe("x");
  });

  it("does not mutate its argument", () => {
    const raw = { week_start: "w", extra: 1, runs: [{ key: "a", sets: [] }] };
    const copy = structuredClone(raw);
    projectManifest(raw);
    expect(raw).toEqual(copy);
  });

  it("states the key lists Python owns", () => {
    /* The Python half is `test_publish.py`'s, which parses this file. Here the
     * lists are only checked for shape, so a reordering shows up as a diff. */
    expect(MANIFEST_KEYS).toEqual(["week_start", "week_type", "phase", "rest_days"]);
    expect(MANIFEST_RUN_KEYS).toEqual(["key", "date", "role", "prescribed", "alternates"]);
    expect(MANIFEST_ALT_KEYS).toEqual(["role", "prescribed"]);
  });
});

/* THE CROSSING. Every fixture manifest projected here must equal what
 * `publish.py` published for that week -- the fixture athlete's own records,
 * built from these very files. In the demo's checkout the manifests are absent
 * and the case says so rather than passing on nothing. */
describe.skipIf(!fs.existsSync(FIXTURE_WEEKS_DIR))(
  "the projection reproduces the published manifests",
  () => {
    const slug = athleteSlugs()[0];
    const names = fs
      .readdirSync(FIXTURE_WEEKS_DIR)
      .filter((n) => n.endsWith(".json"))
      .sort();

    it("has manifests to compare", () => {
      expect(slug).toBeTruthy();
      expect(names.length).toBeGreaterThan(3);
    });

    it.each(names)("%s", (name) => {
      const start = name.slice(0, -5);
      const raw = JSON.parse(
        fs.readFileSync(path.join(FIXTURE_WEEKS_DIR, name), "utf-8"),
      );
      const week = JSON.parse(
        readRequiredText(slug!, `weeks/${start}/week.json`),
      ) as { manifest: unknown };
      expect(projectManifest(raw)).toEqual(week.manifest);
    });
  },
);

describe("windowStarts", () => {
  it("is the count Mondays ending on the anchor's, oldest first", () => {
    expect(windowStarts("2026-10-12", 3, addDays)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
  });

  it("is the anchor's Monday alone at a count of one", () => {
    expect(windowStarts("2026-10-12", 1, addDays)).toEqual(["2026-10-12"]);
  });

  it("is empty at a count of zero", () => {
    expect(windowStarts("2026-10-12", 0, addDays)).toEqual([]);
  });

  it("crosses a year boundary", () => {
    expect(windowStarts("2026-01-05", 2, addDays)).toEqual([
      "2025-12-29",
      "2026-01-05",
    ]);
  });

  it("is what the calendar slice sends -- six weeks", () => {
    const got = windowStarts("2026-10-12", CALENDAR_WEEKS, addDays);
    expect(got).toHaveLength(CALENDAR_WEEKS);
    expect(got.at(-1)).toBe("2026-10-12");
    for (const start of got) expect(mondayOf(start)).toBe(start);
  });
});

describe("pendingPlans", () => {
  const manifests: Record<string, unknown> = {
    "2026-10-05": { week_start: "2026-10-05", notes: { x: "prose" }, runs: [] },
    "2026-10-12": {
      week_start: "2026-10-12",
      runs: [{ key: "a", date: "2026-10-13", role: "easy", sets: [] }],
    },
    "2026-11-30": { week_start: "2026-11-30", runs: [] },
  };
  const read = (start: string) => manifests[start] ?? null;
  const current = { "2026-10-05": "1", "2026-10-12": "2", "2026-11-30": "3" };

  it("counts every pending week, inside the window or not", () => {
    const got = pendingPlans(current, {}, ["2026-10-05", "2026-10-12"], read);
    expect(got.pending).toEqual(["2026-10-05", "2026-10-12", "2026-11-30"]);
  });

  it("overlays only the pending weeks inside the window", () => {
    const got = pendingPlans(current, {}, ["2026-10-05", "2026-10-12"], read);
    expect(Object.keys(got.overlays).sort()).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("projects each overlay to the published shape", () => {
    const got = pendingPlans(current, {}, ["2026-10-05", "2026-10-12"], read);
    expect(got.overlays["2026-10-05"]).toEqual({ week_start: "2026-10-05", runs: [] });
    expect(got.overlays["2026-10-12"]).toEqual({
      week_start: "2026-10-12",
      runs: [{ key: "a", date: "2026-10-13", role: "easy" }],
    });
  });

  it("overlays nothing for a week that is graded", () => {
    const got = pendingPlans(
      current,
      { "2026-10-05": "1" },
      ["2026-10-05", "2026-10-12"],
      read,
    );
    expect(got.pending).toEqual(["2026-10-12", "2026-11-30"]);
    expect(Object.keys(got.overlays)).toEqual(["2026-10-12"]);
  });

  it("does not read a manifest it will not draw", () => {
    const asked: string[] = [];
    pendingPlans(current, {}, ["2026-10-12"], (s) => {
      asked.push(s);
      return read(s);
    });
    expect(asked).toEqual(["2026-10-12"]);
  });

  it("counts a pending week it cannot read, and draws nothing for it", () => {
    const got = pendingPlans({ "2026-10-19": "9" }, {}, ["2026-10-19"], () => null);
    expect(got).toEqual({ pending: ["2026-10-19"], overlays: {} });
  });

  it("is NO_PENDING_PLANS when everything is graded", () => {
    expect(pendingPlans(current, current, ["2026-10-12"], read)).toEqual(
      NO_PENDING_PLANS,
    );
  });
});

describe("windowDates", () => {
  it("is every date of the window, Monday of the oldest week to the anchor week's Sunday", () => {
    const got = windowDates("2026-10-12", 2, addDays);
    expect(got).toHaveLength(14);
    expect(got[0]).toBe("2026-10-05");
    expect(got[6]).toBe("2026-10-11");
    expect(got[7]).toBe("2026-10-12");
    expect(got.at(-1)).toBe("2026-10-18");
  });

  it("is strictly consecutive -- no date skipped or repeated", () => {
    const got = windowDates("2026-10-12", CALENDAR_WEEKS, addDays);
    expect(got).toHaveLength(7 * CALENDAR_WEEKS);
    for (let i = 1; i < got.length; i++) expect(got[i]).toBe(addDays(got[i - 1], 1));
  });

  it("covers exactly the weeks `windowStarts` names", () => {
    const starts = windowStarts("2026-10-12", 4, addDays);
    const dates = windowDates("2026-10-12", 4, addDays);
    expect(dates.filter((_, i) => i % 7 === 0)).toEqual(starts);
  });

  it("crosses a month and a year boundary", () => {
    const got = windowDates("2026-12-28", 1, addDays);
    expect(got).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
      "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it("is empty for a zero-week window", () => {
    expect(windowDates("2026-10-12", 0, addDays)).toEqual([]);
  });

  it("agrees with the calendar window the page asks for", () => {
    const anchor = "2026-10-18";
    const got = windowDates(mondayOf(anchor), CALENDAR_WEEKS, addDays);
    expect(got.at(-1)).toBe(anchor);
  });
});
