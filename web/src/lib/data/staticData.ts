/* Which half of the app is running, decided at BUILD time.
 *
 * The private app reads the published tree per request through `node:sqlite`.
 * The public demo is a static export on GitHub Pages, which runs nothing: it
 * ships every record ONCE as `records.json` and builds the identical index in
 * the browser with sqlite-wasm, then runs the identical SQL from `lib/query/`.
 *
 * BOTH BRANCHES ARE TRACKED AND TESTED, and the exporter patches no route to
 * choose between them -- it sets `NEXT_PUBLIC_STATIC_DATA` in the generated
 * `next.config.ts` and nothing else. A patched route would be a FORK of four
 * files; a build-time constant is a branch the suite can exercise from either
 * side, which matters because the demo's path is otherwise only ever run three
 * repositories away.
 *
 * `NEXT_PUBLIC_` IS WHAT MAKES IT A CONSTANT. Next inlines those at build time
 * rather than reading `process.env` in the browser, so the unused branch --
 * with `loadPayload` and `node:sqlite` behind it -- is dead code the bundler
 * drops. Reading a plain `process.env.X` here would put the string `process` in
 * a client bundle and keep both halves.
 *
 * WHY THE DEMO STILL PRERENDERS THE SHELL AND `/`. `layout.tsx` and
 * `app/page.tsx` read the records at BUILD time, where the tree is on disk --
 * so the top bar, the week picker and the landing week paint with no fetch at
 * all. Only the routes a reader NAVIGATES to wait on the index, which is the
 * trade this whole arrangement is: ~55 MB of prerendered slices becomes ~5 KB
 * shells plus one 703 KB download.
 */

/** True in the static export, false in the private app. */
export const STATIC_DATA = process.env.NEXT_PUBLIC_STATIC_DATA === "1";

/** Where the records bundle is served from.
 *
 * `basePath` PREFIXES IT AND NOTHING IN THE APP KNOWS THAT NUMBER. A GitHub
 * Pages project site is served from its repo name, so the demo's config sets
 * `basePath: "/training-demo"` and Next rewrites its own asset URLs -- but a
 * bare `fetch("/records.json")` is ours, not Next's, and would miss. The
 * exporter writes the same value into both places; here it is read back rather
 * than guessed.
 *
 * EMPTY IN DEVELOPMENT AND IN THE PRIVATE APP, where the site is served from
 * the root. That is the same phase distinction the generated `next.config.ts`
 * makes, and for the same reason: a prefix describes where the site is HOSTED.
 */
export const BUNDLE_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/records.json`;
