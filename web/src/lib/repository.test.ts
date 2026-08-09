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
