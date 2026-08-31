/* The two sources are interchangeable, which is the whole premise.
 *
 * `buildInto()` takes a `RecordSource` so the same builder can run against the
 * published tree on the server and against a shipped bundle in a browser. That
 * only means anything if the two answer IDENTICALLY -- the same bytes for the
 * same key, the same absence for the same missing record. A difference here
 * would surface as a demo whose numbers quietly disagree with the private app's,
 * which is the failure this repo refuses everywhere else by proving the new
 * store equal to the one it replaces.
 *
 * BYTES, NOT PARSED OBJECTS. `JSON.parse(JSON.stringify(x))` round-trips most
 * things and normalises a few -- key order, number formatting -- and the index
 * has to reassemble a payload asserted equal to the file reader's leaf for
 * leaf. Comparing text is what catches a re-serialisation.
 */

import { describe, expect, it } from "vitest";

import { bundleFor } from "../db/bundle";
import { fileSource } from "../db/fileSource";
import { athleteSlugs } from "../repository";
import { bundleSource } from "./bundleSource";

const slug = athleteSlugs()[0];

/* ONE OF EACH, outside every case: building the bundle runs a whole throwaway
 * index, and paying that per assertion is the O(n-squared) mistake this repo
 * has already made once in `repository.test.ts`. */
const bundle = slug ? bundleFor(slug) : null;
const file = slug ? fileSource(slug) : null;
const wire = bundle ? bundleSource(bundle) : null;

describe.skipIf(!slug)("the file source and the bundle source agree", () => {
  it("carries enough records to be worth comparing", () => {
    // Every case below is vacuous over an empty bundle.
    expect(Object.keys(bundle!).length).toBeGreaterThan(1000);
  });

  it("parses the same catalog", () => {
    expect(wire!.index()).toEqual(file!.index());
  });

  it("returns byte-identical text for every record in the bundle", () => {
    for (const rel of Object.keys(bundle!)) {
      expect(wire!.required(rel), rel).toBe(file!.required(rel));
    }
  });

  it("carries every record the catalog names", () => {
    /* The bundle is a TRANSCRIPT of what `buildInto` asked for, so this is the
     * check that the transcript covers the catalog rather than some prefix of
     * it -- a builder that threw halfway would still return a plausible map. */
    const index = wire!.index();
    for (const start of index.weeks) {
      expect(bundle, start).toHaveProperty([`weeks/${start}/week.json`]);
      expect(bundle, start).toHaveProperty([`weeks/${start}/trimp.json`]);
    }
    for (const date of index.days) {
      expect(bundle, date).toHaveProperty([`days/${date}.json`]);
    }
    for (const key of index.pace_charts) {
      expect(bundle, key).toHaveProperty([`pace-charts/${key}.json`]);
    }
    for (const rel of [
      "history.json",
      "thresholds.json",
    ]) {
      expect(bundle, rel).toHaveProperty([rel]);
    }
  });

  it("spells an ABSENT optional record the same way on both sides", () => {
    /* `published/` says "the grader failed" by not writing the file, and
     * `readWeek()` turns that into `adherence: null`. A bundle that carried the
     * key holding an empty string would turn an ungraded week into a week with
     * an empty grade -- present, and wrong. */
    expect(wire!.optional("weeks/1999-01-04/adherence.json")).toBeNull();
    expect(file!.optional("weeks/1999-01-04/adherence.json")).toBeNull();
  });

  it("finds at least one week where a grader really did not write", () => {
    // Otherwise the case above is about a week that does not exist and says
    // nothing about the real tree.
    const optional = ["adherence.json", "load.json", "notes-adherence.html", "notes-load.html"];
    const missing = wire!
      .index()
      .weeks.flatMap((start) =>
        optional.filter((f) => bundle![`weeks/${start}/${f}`] === undefined),
      );
    expect(missing.length).toBeGreaterThan(0);
  });

  it("raises rather than inventing a record it does not have", () => {
    /* Same sentence shape the file reader raises, because it is the same
     * broken promise: the catalog named a record that is not there. */
    expect(() => wire!.required("weeks/1999-01-04/week.json")).toThrow(/missing/);
    expect(() => file!.required("weeks/1999-01-04/week.json")).toThrow(/missing/);
  });
});
