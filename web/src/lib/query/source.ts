/* Where the records come from, as an interface with two implementations.
 *
 * `buildInto()` took a SLUG until the static export needed an index in the
 * browser. A slug is a filesystem idea -- it names a directory under
 * `athletes/` -- and there is no filesystem on GitHub Pages, so the builder had
 * to stop naming its source and start being handed one.
 *
 * THE FOUR METHODS ARE THE FOUR THINGS `build.ts` ALREADY CALLED. This is not a
 * new abstraction over the reader; it is the reader's existing surface written
 * down. `lib/db/fileSource.ts` is those exact functions from `records.ts`, and
 * `lib/query/bundleSource.ts` is the same four over an in-memory map.
 *
 * IT CHANGES NOTHING ABOUT WHAT A RECORD IS. `records.ts` is still the
 * definition and still the reference `assemblePayload()` is asserted against
 * leaf for leaf; the file source is a rename of its four entry points, not a
 * second reader. `tests/test_web_segregation.py` keeps that honest by refusing
 * a `node:fs` import anywhere in `lib/db/` or `lib/query/` outside
 * `records.ts`.
 */

/** The catalog. Readers iterate THIS rather than listing directories, so the
 *  order of weeks and days is decided by Python, once. */
export type Index = {
  schema: number;
  athlete: unknown;
  banners: unknown[];
  weeks: string[];
  days: string[];
  /** The chart table's keys. `assembleFromRecords()` reaches charts through
   *  the weeks that name them; the index builder loads the table whole. */
  pace_charts: string[];
};

/** How stale an already-built index is allowed to be.
 *
 * On the server this is `index.json`'s mtime and size, which advances whenever
 * `publish.py` rewrites the tree. In the browser the bundle is fetched once per
 * document and there is nothing to revalidate against, so the wasm source
 * stamps itself from the bundle's own byte length -- a different measurement of
 * the same question, and one that can never say "unchanged" about a bundle that
 * changed size.
 */
export type Stamp = { mtimeMs: number; size: number };

/** Everything `buildInto()` needs, and nothing else. */
export type RecordSource = {
  /** The catalog, parsed. */
  index(): Index;
  /** A record that must exist. Throws `MissingRecord` when it does not. */
  required(rel: string): string;
  /** A record that is allowed not to exist. Absence is the signal. */
  optional(rel: string): string | null;
  /** What this source was as of, for `isCurrent()`. */
  stamp(): Stamp;
};
