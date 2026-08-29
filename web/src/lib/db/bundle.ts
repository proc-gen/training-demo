/* The whole read model as ONE object, for the browser to build an index from.
 *
 * WHY IT EXISTS. GitHub Pages runs nothing, so the static export used to bake
 * each route's slice into its own HTML -- 102 week pages and 154 calendar
 * anchors, each carrying its own copy of the data, for something like 55 MB of
 * output that a reader re-downloaded on every navigation. The demo ships this
 * instead: the records once, ~1.1 MB gzipped, and sqlite-wasm builds the SAME
 * index from them and runs the SAME queries.
 *
 * THE KEYS ARE `records.ts`'s OWN VOCABULARY -- `index.json`,
 * `weeks/<start>/adherence.json`, `days/<date>.json` -- so `bundleSource` and
 * `fileSource` are interchangeable and `buildInto()` cannot tell which one it
 * was handed. `source.test.ts` asserts exactly that, byte for byte.
 *
 * IT IS RECORDED, NOT LISTED, AND THAT IS THE WHOLE DESIGN.
 *
 * The obvious implementation is a list of the paths a bundle should carry --
 * the catalog's weeks and days, four singletons, six files per week. That list
 * already exists inside `buildInto()`, and a second copy of it is a copy that
 * can drift: add a per-week record next month, wire it into the builder, and
 * the bundle silently stops carrying it. The demo would then fail at RUN time,
 * in a browser, three repositories from the edit.
 *
 * So this runs the real builder against a recording wrapper and keeps whatever
 * it asked for. The bundle is complete BY CONSTRUCTION -- it is a transcript of
 * the only function that knows what completeness means. `bundle.test.ts` pins
 * that an index built from the transcript equals one built from the tree.
 *
 * It costs one throwaway index (~95 ms) per call, paid once at `next build`.
 */

import { DatabaseSync } from "node:sqlite";

import { buildInto } from "../query/build";
import type { Bundle } from "../query/bundleSource";
import type { RecordSource } from "../query/source";
import { fileSource } from "./fileSource";

/** A source that answers exactly as `inner` does, and remembers what it said. */
function recording(inner: RecordSource): {
  source: RecordSource;
  seen: Bundle;
} {
  const seen: Bundle = {};
  return {
    seen,
    source: {
      index: () => {
        // Recorded as TEXT, not re-serialised from the parsed object: the
        // bundle has to carry the same bytes the file does, or the index built
        // from it is not the index built from the tree.
        seen["index.json"] = inner.required("index.json");
        return inner.index();
      },
      required: (rel) => (seen[rel] = inner.required(rel)),
      optional: (rel) => {
        const text = inner.optional(rel);
        /* AN ABSENT RECORD IS NOT RECORDED, and that is what makes absence
         * survive the trip. `published/` spells "the grader failed" as a file
         * that was never written, so storing `null` here would turn a missing
         * `adherence.json` into a present one holding nothing -- and
         * `readWeek()`'s null-means-absent contract would read it as a week
         * with an empty grade rather than an ungraded week. */
        if (text !== null) seen[rel] = text;
        return text;
      },
      stamp: () => inner.stamp(),
    },
  };
}

/** Every record `buildInto()` reads for `slug`, keyed by its published path. */
export function bundleFor(slug: string): Bundle {
  const { source, seen } = recording(fileSource(slug));
  const db = new DatabaseSync(":memory:");
  try {
    buildInto(db, source);
  } finally {
    db.close();
  }
  return seen;
}
