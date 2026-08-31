/* The data-access boundary: resolving an athlete, and the shape of the records
 * on disk.
 *
 * These cases lived in `payload.test.ts` while `repository.ts` had no test file
 * of its own. They are not about the schema -- they are about the port of
 * `unpublish()` and about the decomposition it reads, which is the thing a
 * database will one day replace.
 *
 * `node:fs` here is deliberate and permitted: `tests/test_web_segregation.py`
 * exempts test files from the "only the repository touches the filesystem"
 * rule, because asserting the on-disk layout directly is the whole point of
 * having a layout.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { publishedDir, registryDir } from "./repo";
import { assemble, athleteSlugs, isSlug, resolveSlug } from "./repository";

describe("the record layout on disk", () => {
  const slug = athleteSlugs()[0];

  it.skipIf(!slug)("is decomposed -- one directory per week", () => {
    const dir = path.join(publishedDir(slug), "weeks");
    const weeks = fs.readdirSync(dir);
    expect(weeks.length).toBeGreaterThan(0);
    for (const w of weeks) {
      expect(fs.existsSync(path.join(dir, w, "week.json"))).toBe(true);
    }
  });

  it.skipIf(!slug)("is decomposed -- one file per day", () => {
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    );
    expect(index.days.length).toBeGreaterThan(0);
    for (const date of index.days) {
      expect(
        fs.existsSync(path.join(publishedDir(slug), "days", `${date}.json`)),
      ).toBe(true);
    }
  });

  it.skipIf(!slug)("holds nothing but the records the catalog names", () => {
    // Guards the orphan case from the other side: `write_tree` deletes what a
    // fresh build no longer produces, so a leftover week here means a build
    // that never ran.
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    );
    const onDisk = fs.readdirSync(path.join(publishedDir(slug), "weeks")).sort();
    expect(onDisk).toEqual([...index.weeks].sort());
  });
});

describe("assembling a payload", () => {
  const slug = athleteSlugs()[0];

  it.skipIf(!slug)("rejoins a week from its records", () => {
    const got = assemble();
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    const payload = got.payload as { weeks: Record<string, unknown> };
    expect(Object.keys(payload.weeks).length).toBeGreaterThan(0);
  });

  it.skipIf(!slug)("iterates the CATALOG, not the directory", () => {
    // Ordering is decided by Python, once. The assembled weeks must be exactly
    // `index.weeks` -- a reader that listed directories would sort by whatever
    // the filesystem returned.
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    );
    const got = assemble();
    if (!got.ok) throw new Error(got.error);
    const payload = got.payload as {
      weeks: Record<string, unknown>;
      days: unknown[];
    };
    expect(Object.keys(payload.weeks)).toEqual(index.weeks);
    expect(payload.days).toHaveLength(index.days.length);
  });

  it.skipIf(!slug)("reads an absent grader result as null, not as a throw", () => {
    // A grader that failed wrote NO file and its reason sits in week.json.
    const got = assemble();
    if (!got.ok) throw new Error(got.error);
    const weeks = (got.payload as { weeks: Record<string, unknown> }).weeks;
    for (const w of Object.values(weeks) as Record<string, unknown>[]) {
      expect(w.adherence === null || typeof w.adherence === "object").toBe(true);
      expect(w.load === null || typeof w.load === "object").toBe(true);
    }
  });
});

describe("resolving an athlete", () => {
  it("finds the sole athlete with no argument", () => {
    const slugs = athleteSlugs();
    if (slugs.length !== 1) return;
    expect(resolveSlug().slug).toBe(slugs[0]);
  });

  it("reports an unknown athlete as an error, not a crash", () => {
    const got = resolveSlug("definitely-not-an-athlete");
    expect(got.slug).toBeNull();
    expect(got.error).toContain("definitely-not-an-athlete");
  });

  it("reports it through assemble() too", () => {
    const got = assemble("definitely-not-an-athlete");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toContain("definitely-not-an-athlete");
  });

  it("rejects anything with a path separator", () => {
    // The one value that arrives from outside, used to build a filesystem
    // path. Rejected outright rather than normalised.
    for (const bad of ["../secrets", "a/b", "a\\b", "..", "/etc", "C:"]) {
      expect(isSlug(bad)).toBe(false);
      expect(resolveSlug(bad).slug).toBeNull();
    }
  });

  it("rejects a name that starts with a separator-free dot or dash", () => {
    // `..` is covered above; these are the neighbours of it that a looser
    // pattern would let through into a path join.
    for (const bad of [".hidden", "-flag", "", "a b"]) {
      expect(isSlug(bad)).toBe(false);
    }
  });

  it("accepts an ordinary slug", () => {
    for (const ok of ["micah", "micah-old", "a.b", "a_b", "x1"]) {
      expect(isSlug(ok)).toBe(true);
    }
  });

  it("names the alternatives when the slug is unknown", () => {
    const slugs = athleteSlugs();
    if (!slugs.length) return;
    const got = resolveSlug("nobody");
    expect(got.error).toContain(slugs[0]);
  });

  it("does not treat a directory without published/ as an athlete", () => {
    // `athletes/` may hold a root that has never been built. It is not an
    // athlete this app can show.
    for (const slug of athleteSlugs()) {
      expect(
        fs.existsSync(path.join(publishedDir(slug), "index.json")),
      ).toBe(true);
      expect(fs.existsSync(path.join(registryDir(), slug))).toBe(true);
    }
  });
});

describe("readWeek is a PORT of unpublish(), so it must carry what it carries", () => {
  /* IT DROPPED A KEY FOR A DAY AND NO TEST NOTICED. `publish.py` started
   * writing `pace_chart_is_carried_forward` on 2026-08-14 and `readWeek` never
   * copied it, so every week arrived with it `undefined` -- which the paces
   * rail reads as "this week has a chart of its own", the exact opposite of the
   * truth for a week authored two Mondays ahead. It cost no failure either: the
   * two cases over the committed tree key on that field, so both SKIPPED.
   *
   * The Python round trip is asserted leaf for leaf; this is the TypeScript
   * half of the same contract, and it is the half that had no check at all. */
  const slugs = athleteSlugs();

  /* The one key `week.json` states that is RESOLVED rather than copied.
   *
   * The chart became a table on 2026-08-29, so the week record stores a
   * foreign key and `readWeek` reads the row it names. Pinning it here rather
   * than loosening the check is deliberate: a join is the one honest reason a
   * stored key may be absent from the assembled object, and every OTHER
   * absence is the `pace_chart_is_carried_forward` defect again. The
   * resolution itself is asserted below, so nothing about the chart is
   * unchecked -- it is checked differently.
   *
   * SINCE 2026-08-30 THE KEY IS USUALLY NOT STATED AT ALL -- it is derived from
   * `week_start` and the catalog -- so this mapping applies only to a week
   * where `_drop` refused and the grader's own key survived. It is kept rather
   * than deleted because that case is real, and the two derived keys are
   * asserted directly in the next case instead. */
  const RESOLVED: Record<string, string> = {
    pace_chart_week_ending: "pace_chart",
  };

  /** `week_start - 1`, spelled independently of the app's own helper.
   *
   * A test that reuses the implementation's arithmetic cannot catch that
   * arithmetic being wrong. This is the one date rule the whole chart join
   * turns on, so it is written out here rather than imported. */
  function dayBefore(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d - 1));
    const p = (n: number) => String(n).padStart(2, "0");
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
  }

  it("copies every key the record on disk states", () => {
    if (!slugs.length) return;
    const slug = slugs[0];
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    ) as { weeks: string[] };
    expect(index.weeks.length).toBeGreaterThan(0);
    /* ONE assemble, outside the loop -- it is a pure function of the tree, and
     * calling it per week made this case O(weeks squared): at nine weeks that
     * was invisible, at forty (the 2025 backfill) it was a 13-second timeout. */
    const got = assemble();
    if (!got.ok) throw new Error(got.error);
    const weeks = (got.payload as { weeks: Record<string, unknown> }).weeks;
    for (const start of index.weeks) {
      const raw = JSON.parse(
        fs.readFileSync(
          path.join(publishedDir(slug), "weeks", start, "week.json"),
          "utf-8",
        ),
      ) as Record<string, unknown>;
      const week = weeks[start] as Record<string, unknown>;
      for (const k of Object.keys(raw)) {
        const want = RESOLVED[k] ?? k;
        expect(
          Object.keys(week),
          `${start}/week.json key \`${k}\``,
        ).toContain(want);
      }
    }
  });

  it("resolves the chart key into the chart itself", () => {
    if (!slugs.length) return;
    const slug = slugs[0];
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    ) as { pace_charts: string[] };
    const got = assemble();
    if (!got.ok) throw new Error(got.error);
    const weeks = (got.payload as { weeks: Record<string, unknown> }).weeks;
    let joined = 0;
    for (const [start, w] of Object.entries(weeks)) {
      const raw = JSON.parse(
        fs.readFileSync(
          path.join(publishedDir(slug), "weeks", start, "week.json"),
          "utf-8",
        ),
      ) as { pace_chart_week_ending?: string | null };
      const chart = (w as { pace_chart?: { week_ending?: string } | null })
        .pace_chart;
      /* THE KEY IS DERIVED UNLESS THE RECORD STATES ONE (2026-08-30). It is
       * the newest catalog entry at or before `week_start - 1`, and `_drop`
       * removes it only where that formula reproduced what the grader wrote --
       * so a stored key still wins outright and is still checked here. */
      const want =
        "pace_chart_week_ending" in raw
          ? raw.pace_chart_week_ending
          : (index.pace_charts.filter((k) => k < start).pop() ?? null);
      if (want == null) {
        expect(chart, `${start} resolves to no chart`).toBeNull();
        continue;
      }
      /* The row that comes back must be the row the key NAMES -- not merely
       * some chart. A lookup that silently returned a neighbour would be the
       * `snapshot_date` / `week_end` defect wearing new clothes. */
      expect(chart?.week_ending, start).toBe(want);
      /* THE FLAG THIS BLOCK EXISTS FOR, asserted directly now that it is
       * derived rather than copied. `undefined` reads as "this week has a
       * chart of its own", which is the exact opposite of the truth for a week
       * authored two Mondays ahead -- the 2026-08-14 defect, which cost no
       * failure because both cases keyed on the field and SKIPPED. */
      const carried = (w as { pace_chart_is_carried_forward?: unknown })
        .pace_chart_is_carried_forward;
      expect(typeof carried, `${start} carried-forward flag`).toBe("boolean");
      expect(carried, start).toBe(want !== dayBefore(start));
      joined++;
    }
    expect(joined, "no week joined a chart -- the case asserted nothing")
      .toBeGreaterThan(0);
  });

  /* `pace-chart-current.json` WAS A POINTER RECORD AND IS GONE (2026-08-30).
   * It named the newest chart, which is the last entry of a catalog assembled
   * from those very filenames -- so it was a stored copy of a value
   * `index.json` already states, and the one record in the tree that changed
   * on every confirmed chart by construction. */
  it("takes the current chart as the newest in the table", () => {
    if (!slugs.length) return;
    const slug = slugs[0];
    expect(
      fs.existsSync(path.join(publishedDir(slug), "pace-chart-current.json")),
      "the pointer record is not published any more",
    ).toBe(false);
    const index = JSON.parse(
      fs.readFileSync(path.join(publishedDir(slug), "index.json"), "utf-8"),
    ) as { pace_charts: string[] };
    const got = assemble();
    if (!got.ok) throw new Error(got.error);
    const cur = (got.payload as {
      pace_chart_current?: { week_ending?: string } | null;
    }).pace_chart_current;
    if (!index.pace_charts.length) {
      expect(cur).toBeNull();
      return;
    }
    expect(cur?.week_ending).toBe(
      index.pace_charts[index.pace_charts.length - 1],
    );
  });
});
