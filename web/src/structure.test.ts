/* The layout rules, enforced rather than trusted.
 *
 * This app was four files holding twenty-odd components, and every one of them
 * was reachable only by the file it was buried in. The rules below are what
 * stops that re-forming, and each is here because prose in a CLAUDE.md does not
 * fail a build:
 *
 *   1. every source file has a test beside it
 *   2. one component per .tsx
 *   3. PROXIMITY FOLLOWS REUSE -- one consumer means it lives with that
 *      consumer; two or more means it moves up to the shared container
 *   4. the layers only point one way
 *
 * Text scanning rather than a TypeScript parser, deliberately: adding a parser
 * to check the shape of the tree would be a second toolchain inside the one it
 * is checking, and the patterns below are unambiguous. Same reasoning as
 * `tests/test_web_segregation.py` on the Python side.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname);

/** Every hand-written source file under src/, repo-relative with / separators. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");
const read = (file: string) => fs.readFileSync(file, "utf-8");

const ALL = walk(SRC).map((f) => ({ file: f, rel: rel(f), text: read(f) }));

const isTest = (r: string) => /\.test\.tsx?$/.test(r);
const isDecl = (r: string) => r.endsWith(".d.ts");

/** Files the rules do not apply to, and why.
 *
 * `test/**` is shared FIXTURE code -- writing a test for a test helper is
 * checking the tape measure with itself, and every case that uses it fails
 * loudly when it breaks.
 *
 * `lib/wasmdb/engine.ts` IS THE ONE THAT NEEDED ARGUING FOR. It is two imports:
 * sql.js, and its `.wasm` as a bundler ASSET URL. vitest resolves no such
 * thing, so a test beside it could not even import it -- and a test that
 * scanned its source text instead would assert that two lines say what they
 * plainly say. What actually checks it is `npm run build`, which is why that
 * command is in the verification steps and not just `npm run check`. The two
 * cases below pin what the exemption is worth: the module stays tiny, and it
 * stays the ONLY place the engine package is named.
 */
const EXEMPT = [
  { pattern: /\.test\.tsx?$/, why: "test files are the tests" },
  { pattern: /^test\//, why: "shared fixtures, exercised by every test that uses them" },
  {
    pattern: /^lib\/wasmdb\/engine\.ts$/,
    why: "it imports a .wasm as a bundler asset URL, which only a bundler resolves",
  },
];

/** Files exempt from the reuse rule specifically. */
const REUSE_EXEMPT = [
  {
    pattern: /^lib\/(repo|repository)\.ts$/,
    why: "pinned by literal path in tests/test_web_segregation.py",
  },
];

/* `.d.ts` files carry no behaviour, so they are filtered here rather than
 * exempted above -- an exemption entry that matches nothing is indistinguishable
 * from a stale one, and `src/` has no declaration files today. */
const SOURCES = ALL.filter((f) => !isTest(f.rel) && !isDecl(f.rel));

const exempt = (r: string) => EXEMPT.some((e) => e.pattern.test(r));

/* A COMPONENT DECLARATION: `function Name(`, `export function Name(`,
 * `export default function Name(`, `export default async function Name(`, or a
 * `const Name = (`/`= function` arrow. A PascalCase const holding a plain
 * object or array -- `const M = {`, `const VIEWS: View[] = [` -- is data, not a
 * component, and does not match.
 *
 * `async` JOINED IT WHEN THE ROUTES LANDED. A dynamic route's page awaits its
 * `params` and so must be `export default async function Page(`, which this
 * read as no component at all -- so the "one component per file" rule silently
 * stopped applying to exactly the files that were newest. A regex that matches
 * nothing passes everything built on it, which is why the case below exists. */
const COMPONENT =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+[A-Z]|^(?:export\s+)?const\s+[A-Z][A-Za-z0-9]*(?:\s*:[^=]+)?\s*=\s*(?:\(|function)/gm;

/** Every module specifier a file imports from.
 *
 * The keyword must be followed by WHITESPACE. Without that, `import` also
 * matches the head of the identifier `imports(` -- which is how this very
 * function reported itself as importing a web font.
 */
function imports(text: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*import\s[^"']*["']([^"']+)["']|import\(\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) out.push(m[1] ?? m[2]);
  return out;
}

/** A specifier resolved to a repo-relative source path, or null. */
function resolveImport(fromRel: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith("@/")) target = spec.slice(2);
  else if (spec.startsWith(".")) {
    target = path
      .join(path.dirname(fromRel), spec)
      .split(path.sep)
      .join("/");
  } else return null;

  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const candidate = target + ext;
    if (ALL.some((f) => f.rel === candidate)) return candidate;
  }
  return null;
}

/** The view a file belongs to, or null. */
function viewOf(r: string): string | null {
  const m = /^views\/([^/]+)\//.exec(r);
  return m ? m[1] : null;
}

describe("the exemption lists", () => {
  /* Pinned so the loops below cannot pass vacuously -- an exemption that
   * matches nothing is either stale or a typo, and both read as "the rule is
   * being enforced" when it is not. */

  it.each(EXEMPT)("$why matches something", ({ pattern }) => {
    expect(ALL.some((f) => pattern.test(f.rel))).toBe(true);
  });

  it.each(REUSE_EXEMPT)("$why matches something", ({ pattern }) => {
    expect(ALL.some((f) => pattern.test(f.rel))).toBe(true);
  });

  it("keeps the untestable module tiny, which is what earns it the exemption", () => {
    /* `lib/wasmdb/engine.ts` cannot be imported outside a bundler, so nothing
     * in it is covered. That is only acceptable while there is nothing in it:
     * two imports and one re-export. Logic that drifted in here would be logic
     * no test can reach, which is the failure mode of every exemption. */
    const engine = ALL.find((f) => f.rel === "lib/wasmdb/engine.ts")!;
    const code = engine.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));
    expect(code.length).toBeLessThanOrEqual(4);
  });

  it("names the engine package in that ONE module and nowhere else in src/", () => {
    /* The engine is a bundler-visible dependency with an asset beside it, and
     * the whole point of isolating it is that a change of engine moves one
     * file. `open.ts` reaches it through `./engine`; TEST code may name it --
     * cases and the shared `test/wasmIndex.ts` fixture run it directly in node,
     * where there is no asset to resolve and no bundler to resolve one. */
    const named = SOURCES.filter(
      (f) => !f.rel.startsWith("test/") && /["']sql\.js/.test(f.text),
    ).map((f) => f.rel);
    expect(named).toEqual(["lib/wasmdb/engine.ts"]);
  });

  it("mocks next/navigation in ONE shape, because the registry is shared", () => {
    /* THE RENDER PROJECT RUNS WITH `isolate: false` -- one jsdom and one module
     * registry per worker, which is what took the suite from 50s to 10s. So a
     * `vi.mock("next/navigation", ...)` is not file-scoped in practice:
     * whichever factory the worker registers first answers for every file it
     * later loads. Eight files mocked it with four different shapes, each with
     * its OWN hoisted `push` spy, so a file whose mock lost never saw its spy
     * called -- and `ReportShell.test.tsx` and `CalendarView.test.tsx` failed
     * together on about one run in three while passing alone every time.
     *
     * Every factory returns `@/test/navigation`'s single object now, so a
     * collision cannot matter. This is the pin that keeps it that way. */
    const mocks = ALL.filter(
      (f) => f.rel !== "test/navigation.ts" && /vi\.mock\(\s*["']next\/navigation/.test(f.text),
    );
    expect(mocks.length).toBeGreaterThan(4);
    for (const f of mocks) {
      expect(f.text, f.rel).toContain('(await import("@/test/navigation")).navigation()');
    }
  });

  it("has exactly one .wasm import, which is why the turbopack rule may be global", () => {
    /* `next.config.ts` sets `*.wasm` to `type: "asset"` for the whole project.
     * That is a wider statement than the one being made unless this holds. */
    /* SOURCES, not ALL: `open.test.ts` resolves the same file off disk with
     * `createRequire`, which is how it hands the real engine a real `.wasm` in
     * node. That is a path string, not an import the bundler ever sees. */
    const wasmImports = SOURCES.filter((f) =>
      /["'][^"']*\.wasm["']/.test(f.text),
    ).map((f) => f.rel);
    expect(wasmImports).toEqual(["lib/wasmdb/engine.ts"]);
  });

  it("finds source files at all", () => {
    // The whole suite is vacuous if the walk returns nothing.
    expect(SOURCES.length).toBeGreaterThan(40);
  });
});

describe("every file has a test beside it", () => {
  it("names the ones that do not", () => {
    const missing = SOURCES.filter((f) => {
      if (exempt(f.rel)) return false;
      const base = f.rel.replace(/\.tsx?$/, "");
      return !ALL.some((t) => t.rel === base + ".test.ts" || t.rel === base + ".test.tsx");
    }).map((f) => f.rel);
    expect(missing).toEqual([]);
  });
});

describe("one component per file", () => {
  const components = SOURCES.filter((f) => f.rel.endsWith(".tsx") && !exempt(f.rel));

  it("names any .tsx declaring more than one", () => {
    /* A component buried three hundred lines into a file nobody else imports
     * cannot be reused and cannot be tested on its own. WeekView.tsx held ten. */
    const many = components
      .map((f) => ({ rel: f.rel, n: (f.text.match(COMPONENT) ?? []).length }))
      .filter((f) => f.n > 1);
    expect(many).toEqual([]);
  });

  it("finds a component in every component file", () => {
    // The counter must actually match; a regex that matched nothing would let
    // the rule above pass on every file.
    const none = components
      .filter((f) => (f.text.match(COMPONENT) ?? []).length === 0)
      .map((f) => f.rel);
    expect(none).toEqual([]);
  });
});

describe("hooks live in a hooks/ folder", () => {
  it("names any use* export declared elsewhere", () => {
    const stray = SOURCES.filter((f) => {
      if (/(^|\/)hooks\//.test(f.rel)) return false;
      return /export\s+(?:function|const)\s+use[A-Z]/.test(f.text);
    }).map((f) => f.rel);
    expect(stray).toEqual([]);
  });

  it("names any component declared inside one", () => {
    // A hooks/ folder that accumulates components is a second components/.
    const wrong = SOURCES.filter(
      (f) => /(^|\/)hooks\//.test(f.rel) && f.rel.endsWith(".tsx"),
    ).map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("has hooks to check", () => {
    expect(SOURCES.some((f) => /(^|\/)hooks\//.test(f.rel))).toBe(true);
  });
});

describe("data/ folders hold plain logic", () => {
  it("names any component in one", () => {
    const wrong = SOURCES.filter(
      (f) => /(^|\/)data\//.test(f.rel) && f.rel.endsWith(".tsx"),
    ).map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("names any hook in one", () => {
    const wrong = SOURCES.filter(
      (f) =>
        /(^|\/)data\//.test(f.rel) && /export\s+(?:function|const)\s+use[A-Z]/.test(f.text),
    ).map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("has data modules to check", () => {
    expect(SOURCES.filter((f) => /(^|\/)data\//.test(f.rel)).length).toBeGreaterThan(4);
  });
});

describe("the layers point one way", () => {
  it("lib/ never imports a view or the app", () => {
    const wrong = SOURCES.filter((f) => f.rel.startsWith("lib/")).flatMap((f) =>
      imports(f.text)
        .filter((s) => s.startsWith("@/views") || s.startsWith("@/app"))
        .map((s) => `${f.rel} -> ${s}`),
    );
    expect(wrong).toEqual([]);
  });

  it("lib/ux knows nothing about the payload", () => {
    /* The component library takes props and produces markup. A chart that
     * imported the schema would know what a week is, and could no longer be
     * reused for anything else -- which is why RepPaceChart declares its own
     * `RepPoint` rather than importing `RepRow`. */
    const wrong = SOURCES.filter((f) => f.rel.startsWith("lib/ux/")).flatMap((f) =>
      imports(f.text)
        .filter((s) => /payload$/.test(s))
        .map((s) => `${f.rel} -> ${s}`),
    );
    expect(wrong).toEqual([]);
  });

  it("no view imports a sibling view", () => {
    /* THE CARVE-OUT IS GONE, AND THAT IS THE ROUTES LANDING. `Report` used to
     * be exempt because it was the shell that composed the other three -- one
     * client component holding which view was showing, which is exactly why
     * every week's data had to reach the browser. `app/` composes them now, so
     * `views/Report` imports no sibling and the rule applies to all four
     * without exception. The guard that the composition still happens moved
     * with it: see "the routes compose the views" below. */
    const wrong = SOURCES.flatMap((f) => {
      const from = viewOf(f.rel);
      if (!from) return [];
      return imports(f.text)
        .map((s) => resolveImport(f.rel, s))
        .filter((t): t is string => Boolean(t))
        .filter((t) => {
          const to = viewOf(t);
          return to !== null && to !== from;
        })
        .map((t) => `${f.rel} -> ${t}`);
    });
    expect(wrong).toEqual([]);
  });

  it("the routes compose the views", () => {
    /* The rule above says the views do not know about each other. This says
     * SOMETHING still puts them on a page -- without it, deleting a view's only
     * consumer would make the tree "more correct" by every check here while
     * taking a third of the app off the screen.
     *
     * `app/` and not `views/Report`, because that is where composition moved.
     * `WeekView` is reached through `WeekRoute`, which `/` and `/week/[start]`
     * both render, so the match is on the view DIRECTORY rather than on the
     * `<Name>View` module. */
    const routed = new Set(
      SOURCES.filter((f) => f.rel.startsWith("app/")).flatMap((f) =>
        imports(f.text)
          .map((s) => resolveImport(f.rel, s))
          .filter((t): t is string => Boolean(t))
          .map((t) => viewOf(t))
          .filter((v): v is string => Boolean(v)),
      ),
    );
    expect([...routed].sort()).toEqual([
      "CalendarView",
      "Report",
      "TrendsView",
      "WeekView",
    ]);
  });
});

describe("proximity follows reuse", () => {
  /** Non-test source files importing a given path. */
  function importers(target: string): string[] {
    return SOURCES.filter((f) => f.rel !== target)
      .filter((f) =>
        imports(f.text).some((s) => resolveImport(f.rel, s) === target),
      )
      .map((f) => f.rel);
  }

  it("names anything shared that only one file uses", () => {
    /* A module under lib/data or lib/hooks with a single consumer is not
     * shared -- it belongs inside that consumer, where its documented decision
     * sits beside the code that makes it. This is what sent `defaultWeekKey`
     * to views/Report/data and `calendarRows` to views/CalendarView/data.
     *
     * SCOPED TO lib/data AND lib/hooks, AND lib/ux AND lib/run ARE OUT ON
     * PURPOSE. Those two are component libraries, and internal composition is
     * what a component library IS: `Marker` is only drawn by `LineChart`,
     * `RepSetPanel` only by `SessionDetail`. Applying the rule there would
     * demand every part of a library be used twice, which would push it back
     * into the one-file-holding-twenty-components shape this whole module
     * exists to prevent. What keeps them honest instead is the rule above --
     * no view may import a sibling view -- which is what sent the run subtree
     * up to lib/run when the Calendar's day card needed it. */
    const lonely = SOURCES.filter(
      (f) =>
        /^lib\/(data|hooks)\//.test(f.rel) &&
        !REUSE_EXEMPT.some((e) => e.pattern.test(f.rel)),
    )
      .map((f) => ({ rel: f.rel, by: importers(f.rel) }))
      .filter((f) => f.by.length === 1)
      .map((f) => `${f.rel} is used only by ${f.by[0]}`);
    expect(lonely).toEqual([]);
  });

  it("names anything shared that nothing uses", () => {
    const orphans = SOURCES.filter(
      (f) =>
        /^lib\/(data|hooks)\//.test(f.rel) &&
        !REUSE_EXEMPT.some((e) => e.pattern.test(f.rel)),
    )
      .filter((f) => importers(f.rel).length === 0)
      .map((f) => f.rel);
    expect(orphans).toEqual([]);
  });

  it("resolves imports at all", () => {
    // If resolveImport returned null for everything, both rules above would
    // report every shared module as an orphan -- or nothing as lonely.
    const payload = importers("lib/data/payload.ts");
    expect(payload.length).toBeGreaterThan(5);
  });
});

describe("the server layer never reaches the browser", () => {
  /* THE ONE FAILURE THIS WHOLE FILE EXISTS FOR, and the suite could not see it.
   *
   * `CalendarView` is a client component. It needed to normalise a date before
   * navigating, and the helper it wanted happened to live in `lib/db/slices.ts`
   * -- so one import dragged `records.ts`, and with it `node:fs`, into the
   * browser bundle. Turbopack refused the route with "the chunking context does
   * not support external modules (request: node:fs)" and `/calendar/<end>`
   * returned 500.
   *
   * `npm run check` PASSED THE WHOLE TIME. jsdom runs no bundler, so every
   * render test imported the module happily and every assertion held; the route
   * was broken only when a browser asked for it. That is the exact shape
   * `tests/test_web_segregation.py` describes -- a thing that "would WORK on the
   * machine that wrote it" -- and the fix was to put the date helper with the
   * other date arithmetic, where it belonged anyway.
   *
   * IT IS TRANSITIVE, because one hop is not the hazard. `CalendarView` imported
   * `lib/db` directly, but a client component importing something that imports
   * it is the same bundle and the same 500.
   *
   * `lib/query/` IS THE SANCTIONED WAY ACROSS, and it arrived when the static
   * export needed the index in a browser. The SQL is shared, the HANDLE is not:
   * `lib/query/` holds the queries and touches no filesystem, `lib/db/` opens
   * files and stays server-side. The last case below is what keeps that split
   * real -- a rule saying "the browser may not reach the server" is worth
   * little without one saying which directory the browser MAY reach.
   */

  /** Module specifiers a file imports for their VALUES.
   *
   * `import type { X } from "@/lib/db/records"` is ERASED by the compiler and
   * reaches no bundle, so it is not the hazard this rule is about -- naming
   * the shape of something is exactly what a type import is for. A bare
   * `import { X }` used only as a type is erased too, and IS flagged here: the
   * difference is invisible to a text scan, and the conservative direction
   * pushes towards the explicit keyword rather than towards a rule that can be
   * defeated by dropping it.
   */
  function valueImports(text: string): string[] {
    const out: string[] = [];
    const re = /(?:^|\n)\s*import\s+(type\s+)?[^"']*["']([^"']+)["']/g;
    for (const m of text.matchAll(re)) if (!m[1]) out.push(m[2]);
    return out;
  }

  /** Everything `rel` imports for its values, directly or not, within `src/`. */
  function reachable(rel: string): Set<string> {
    const seen = new Set<string>();
    const stack = [rel];
    while (stack.length) {
      const at = stack.pop()!;
      const file = ALL.find((f) => f.rel === at);
      if (!file) continue;
      for (const spec of valueImports(file.text)) {
        const target = resolveImport(at, spec);
        if (target && !seen.has(target)) {
          seen.add(target);
          stack.push(target);
        }
      }
    }
    return seen;
  }

  const clients = SOURCES.filter((f) => /^\s*["']use client["']/.test(f.text));

  it("finds the client components at all", () => {
    // Every rule below is vacuous if this matches nothing.
    expect(clients.length).toBeGreaterThan(20);
  });

  it("no client component reaches lib/db, even transitively", () => {
    const wrong = clients
      .filter((f) => [...reachable(f.rel)].some((t) => t.startsWith("lib/db/")))
      .map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("no client component reaches a node builtin", () => {
    /* The same rule stated on the symptom rather than the directory, so a
     * server-only module added somewhere else is caught too. */
    const wrong = clients
      .filter((f) =>
        [f.rel, ...reachable(f.rel)].some((t) => {
          const src = ALL.find((x) => x.rel === t);
          return src
            ? valueImports(src.text).some((sp) => sp.startsWith("node:"))
            : false;
        }),
      )
      .map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("TOLERATES a type-only import, which the compiler erases", () => {
    /* Pinned because the rule above would be trivially satisfiable by banning
     * the directory outright, and that would be wrong: a client component
     * naming the shape of its own props is what `import type` is for.
     *
     * ASSERTED ON `valueImports` ITSELF rather than on a file that happens to
     * do it today. `ReportShell` was the example until the SQL moved to
     * `lib/query/` -- which is node-free, so its import is no longer a
     * tolerance at all -- and an example that stops being one turns this into
     * a case that passes without checking anything. */
    const sample = [
      'import type { Shell } from "@/lib/db/records";',
      'import { openIndex } from "@/lib/db/open";',
    ].join("\n");
    expect(valueImports(sample)).toEqual(["@/lib/db/open"]);
  });

  it("no lib/query module reaches a node builtin, which is what makes it shared", () => {
    /* THE POSITIVE HALF OF THE RULE ABOVE. `lib/query/` holds the SQL that BOTH
     * engines run -- `node:sqlite` on the server, sqlite-wasm in the browser for
     * the static export -- and it is only shareable while it stays free of the
     * filesystem. Without this, the two rules above could be satisfied by
     * nothing importing the queries at all, and the day a client route did, the
     * failure would be a 500 in a bundler rather than a sentence here.
     *
     * `lib/db/` is the deliberate other side: it opens files, and nothing that
     * reaches the browser may reach it. */
    const shared = SOURCES.filter((f) => f.rel.startsWith("lib/query/"));
    expect(shared.length).toBeGreaterThan(4);
    const wrong = shared
      .filter((f) =>
        [f.rel, ...reachable(f.rel)].some((t) => {
          const src = ALL.find((x) => x.rel === t);
          return src
            ? valueImports(src.text).some((sp) => sp.startsWith("node:")) ||
                t.startsWith("lib/db/")
            : false;
        }),
      )
      .map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("resolves a transitive chain at all", () => {
    // If `reachable` returned nothing, both rules above would pass on anything.
    const shell = clients.find((f) => f.rel === "views/Report/ReportShell.tsx");
    expect(shell).toBeTruthy();
    expect(reachable(shell!.rel).size).toBeGreaterThan(3);
  });
});

describe("the routes stay statically exportable", () => {
  /* THE DEMO HAS NO SERVER. `export_demo.py` patches every `force-dynamic` to
   * `force-static` and Next writes one HTML file per route; anything that needs
   * a request at run time simply cannot be built. Both rules below are things
   * that WORK in the private app and fail three repositories away, which is the
   * class this file exists to catch.
   *
   * Text scanning, like every other rule here -- and it is why these two live in
   * this module rather than beside the routes they describe: a render test that
   * read its own source through `import.meta.url` broke, because vitest's module
   * URLs are not file URLs. */

  const routes = SOURCES.filter((f) => /^app\/.*page\.tsx$/.test(f.rel));

  /** Every file the export patches: the four pages and the bundle handler. */
  const patched = SOURCES.filter((f) =>
    /^app\/.*(page\.tsx|route\.ts)$/.test(f.rel),
  );

  it("finds the routes at all", () => {
    expect(routes.length).toBeGreaterThan(3);
    expect(patched.length).toBeGreaterThan(routes.length);
  });

  it("declares the caching mode EXACTLY ONCE on every route file", () => {
    /* THIS FILE IS COPIED VERBATIM TO THE MIRROR, so it can only assert what is
     * true in BOTH repos -- and the two differ here by construction: the
     * private app declares `force-dynamic` and `export_demo.py` patches every
     * one to `force-static`.
     *
     * IT ASSERTED `force-dynamic` UNTIL 2026-08-29 AND THAT BROKE THE DEMO'S
     * CI. The mirror runs `npm run check` on the patched copy, so the case
     * failed there naming all four pages -- the first thing the demo's own
     * pipeline had to say about a build that was otherwise fine. It had been
     * latently wrong since the routes landed and only surfaced now because the
     * demo had not been rebuilt since.
     *
     * EXACTLY ONCE is the half worth keeping: `export_demo.py` requires each
     * patch to match once and fails naming the file otherwise, so a route that
     * declared neither -- or declared one twice -- would fail the EXPORT rather
     * than anything here. WHICH of the two a route declares is asserted by the
     * route's own test, which the exporter patches in step with the source. */
    const wrong = patched
      .map((f) => ({
        rel: f.rel,
        n: (f.text.match(/export const dynamic = "force-(dynamic|static)";/g) ?? [])
          .length,
      }))
      .filter((f) => f.n !== 1);
    expect(wrong).toEqual([]);
  });

  it("declares the SAME mode in every route file, never a mixture", () => {
    /* A half-applied patch is the failure this catches: four routes prerendered
     * and one still asking for a server is a build that fails in CI with a
     * message about the one file, three repositories from the edit.
     *
     * IT MATCHES THE DECLARATION, NOT THE WORD, and it caught itself doing the
     * wrong thing first: `/force-(dynamic|static)/` on the whole text finds the
     * COMMENT the export writes above the patched line — *"The private repo
     * declares `force-dynamic` here"* — so every mirrored route read as both.
     * Prose is not a declaration, which is the third time this file has had to
     * say so. */
    const modes = new Set(
      patched.map(
        (f) => /export const dynamic = "force-(dynamic|static)";/.exec(f.text)?.[1],
      ),
    );
    expect([...modes]).toHaveLength(1);
  });

  it("uses NO redirect", () => {
    /* `output: export` cannot emit a server redirect, so `/` renders the
     * default week rather than bouncing to `/week/<default>` -- a redirect
     * would need a client bounce or a meta-refresh, which is a visible flash on
     * the one URL every reader arrives at. */
    const wrong = routes
      .filter((f) => /\bredirect\s*\(/.test(f.text))
      .map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("gives every dynamic segment a generateStaticParams", () => {
    /* Without it the demo build has no list of pages to write, and a URL that
     * was not built does not exist. `force-dynamic` ignores it here, so its
     * absence costs nothing until the export -- which is exactly why it is
     * asserted rather than noticed. */
    const missing = routes
      .filter((f) => f.rel.includes("["))
      .filter((f) => !/export function generateStaticParams/.test(f.text))
      .map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  it("never AWAITS searchParams before the static branch returns", () => {
    /* READING a query string in a server component forces dynamic rendering,
     * which `output: export` cannot do. The calendar's anchor is `?end=` since
     * 2026-08-29, so this rule had to change from "nobody may name it" to the
     * narrower thing that is actually true: the STATIC branch must return
     * first, and in that build the parameter is read in the browser instead.
     *
     * ORDER IS THE WHOLE CHECK. `await searchParams` above the branch would
     * fail the demo build; below it, Next prerenders the route — verified, it
     * emits `/calendar` as static. So this compares positions in the text, and
     * a page naming `searchParams` with NO static branch at all fails too,
     * `indexOf` returning -1 for the branch it does not have.
     *
     * IT READ `/\bsearchParams\b/` AND MATCHED NOTHING FOR MONTHS. The `\b`
     * escapes were literal BACKSPACE bytes in the committed file — the same
     * class of damage `CLAUDE.md` records for `Get-Content | Set-Content`, one
     * tool over — so the rule passed while `app/api/data/route.ts` plainly read
     * the request. `tests/test_athlete_paths.py` now fails any control
     * character in a tracked file, which is what stops that recurring. */
    const wrong = SOURCES.filter((f) => f.rel.startsWith("app/"))
      .filter((f) => !f.rel.startsWith("app/api/"))
      .filter((f) => /await\s+searchParams/.test(f.text))
      .filter((f) => {
        const branch = f.text.indexOf("STATIC_DATA");
        const read = f.text.search(/await\s+searchParams/);
        return branch === -1 || branch > read;
      })
      .map((f) => f.rel);
    expect(wrong).toEqual([]);
  });

  it("finds the page that DOES read searchParams, so the rule is not vacuous", () => {
    /* The rule above passes trivially over an app where nobody reads a query
     * string, which is exactly what it looked like while the regex was
     * corrupted. */
    const readers = SOURCES.filter((f) => f.rel.startsWith("app/"))
      .filter((f) => /await\s+searchParams/.test(f.text))
      .map((f) => f.rel);
    expect(readers).toContain("app/calendar/page.tsx");
  });

  it("exempts app/api/ only because the export DROPS it whole", () => {
    /* `app/api/data/route.ts` reads `?athlete=` off the request, which cannot
     * be statically exported at all -- so it is not patched, it is removed.
     * `tests/test_export_demo.py::test_the_request_reading_route_is_dropped`
     * is the other half of this, and without that the exemption above would be
     * a hole rather than a division of labour.
     *
     * TWO ANSWERS, BECAUSE THIS FILE RUNS IN BOTH REPOS. In the private app the
     * directory is there and reads the request, which is WHY it is dropped; in
     * the mirror it is absent, which is the drop having happened. Asserting the
     * first alone is how a case passes here and fails the demo's own CI -- the
     * mistake this whole block was just fixed for. */
    const api = SOURCES.filter((f) => f.rel.startsWith("app/api/"));
    if (api.length === 0) return; // the mirror: dropped, nothing to exempt
    expect(api.some((f) => /searchParams/.test(f.text))).toBe(true);
  });
});

describe("the page owes nothing to a third party", () => {
  it("imports no web font", () => {
    /* `next/font/google` fetches at BUILD time. This page renders resting heart
     * rate, HRV, sleep and weight.
     *
     * Checked against the IMPORTS rather than the text: `layout.tsx` names the
     * thing it is refusing to use, in a comment, and forbidding the string
     * would trade a useful explanation for a check this already makes. Same
     * reasoning as `publish.py` appearing in the app's error text. */
    const wrong = ALL.filter((f) =>
      imports(f.text).some((s) => s.startsWith("next/font")),
    ).map((f) => f.rel);
    expect(wrong).toEqual([]);
  });
});
