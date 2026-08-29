/* The engine and its `.wasm`, in the one module that names the package.
 *
 * TWO IMPORTS AND NOTHING ELSE, on purpose. `open.ts` is the logic -- fetch,
 * build, hand back a `Db` -- and it is worth being able to read that without
 * the bundler-specific incantation for locating a WebAssembly file in the
 * middle of it. This is that incantation, isolated, so a change of engine or a
 * change of bundler moves one file.
 *
 * THE `.wasm` IS A STATIC IMPORT, WHICH IS THE WHOLE TRICK. Turbopack sees it,
 * emits the file into `_next/static/` and hands back a URL that already carries
 * the build's `basePath` -- so the demo, served from a GitHub Pages project
 * sub-path, fetches its engine from the right place without anything in the app
 * knowing the repo name. Asking sql.js for it by bare name (its default) would
 * fetch `/sql-wasm.wasm` from the document root, which on a project site
 * belongs to another repository.
 *
 * It also means the file does NOT have to be vendored into `public/`: no
 * 644 KB binary tracked in two repositories, and nothing for
 * `scripts/export_demo.py` -- which copies UTF-8 text -- to choke on.
 */

// @ts-expect-error -- a `.wasm` import is a bundler asset URL, which the
// TypeScript resolver has no type for. `next-env.d.ts` declares the module
// shapes Next itself provides and this is not among them; declaring it here
// would be a global module declaration in a leaf file, which is worse.
import wasm from "sql.js/dist/sql-wasm.wasm";

export { default } from "sql.js";

/** Where the engine's WebAssembly lives, `basePath` included. */
export const wasmUrl: string = wasm;
