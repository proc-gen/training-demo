/* A `RecordSource` over records held in memory. The browser's half.
 *
 * WHAT A BUNDLE IS. `published/` is 1,272 files and the static export ships
 * them as ONE JSON object keyed by the same relative paths `records.ts` reads
 * -- `index.json`, `weeks/2026-08-10/adherence.json`, `days/2026-08-11.json`.
 * The keys are the reader's own vocabulary on purpose: the bundle is the
 * published tree with the directory separators left in the key instead of in a
 * filesystem, so `buildInto()` cannot tell which source it was handed.
 *
 * WHY NOT SHIP A PREBUILT `.sqlite`. It would save the browser the build (~95 ms
 * on the server; a few hundred in wasm) and cost a binary artifact that
 * something has to produce. Producing it means a writer inside `lib/db/` that
 * opens a file, which `tests/test_web_segregation.py` refuses outside
 * `records.ts` -- and that refusal is what keeps `assemblePayload()`'s equality
 * against `assembleFromRecords()` meaningful. A text bundle needs no new
 * filesystem site anywhere: the route that emits it reads through `records.ts`
 * like everything else.
 *
 * THE STAMP IS THE BUNDLE'S OWN SIZE. There is nothing to revalidate against in
 * a browser -- the bundle is fetched once per document -- so `isCurrent()`
 * answers true for the life of the page, which is the truth. It is still a
 * MEASUREMENT rather than a constant, so an index built from one bundle can
 * never claim to be current for a different one.
 */

import { MissingRecord } from "./errors";
import type { Index, RecordSource, Stamp } from "./source";

/** The wire format: every published record's path mapped to its exact bytes. */
export type Bundle = Record<string, string>;

/** A source over an already-fetched bundle. */
export function bundleSource(bundle: Bundle): RecordSource {
  /* Counted once rather than per call. `stamp()` is asked twice per build and
   * once per `isCurrent()`, and summing 1,272 string lengths each time would
   * make the cheap check the expensive one. */
  let size: number | null = null;

  const required = (rel: string): string => {
    const text = bundle[rel];
    if (text === undefined) {
      // Same sentence shape the file reader raises, because it is the same
      // broken promise: the catalog named a record that is not there.
      throw new MissingRecord(`published/${rel} is missing from the bundle`);
    }
    return text;
  };

  return {
    index: () => {
      const text = required("index.json");
      try {
        return JSON.parse(text) as Index;
      } catch (e) {
        throw new MissingRecord(
          `published/index.json is not JSON: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    },
    required,
    /* `?? null`, not `|| null`: an EMPTY note is a note that exists, and the
     * publisher writes prose with no trailing newline precisely so that an
     * empty note and a one-newline note are different files. `||` would turn
     * the first into an absent record. */
    optional: (rel: string) => bundle[rel] ?? null,
    stamp: (): Stamp => {
      if (size === null) {
        size = 0;
        for (const key of Object.keys(bundle)) size += bundle[key].length;
      }
      // `mtimeMs` has no meaning here and must not pretend to. Zero is the one
      // value that cannot be mistaken for a reading off a clock.
      return { mtimeMs: 0, size };
    },
  };
}
