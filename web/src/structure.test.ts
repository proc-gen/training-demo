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
 */
const EXEMPT = [
  { pattern: /\.test\.tsx?$/, why: "test files are the tests" },
  { pattern: /^test\//, why: "shared fixtures, exercised by every test that uses them" },
];

/** Files exempt from the reuse rule specifically. */
const REUSE_EXEMPT = [
  {
    pattern: /^lib\/(repo|repository)\.ts$/,
    why: "pinned by literal path in tests/test_web_segregation.py",
  },
  {
    pattern: /^lib\/data\/loadPayload\.ts$/,
    why:
      "THIS MIRROR ONLY. The private repo has two consumers -- app/page.tsx " +
      "and the /api/data route -- and that route reads `?athlete=` off the " +
      "request, which a static export cannot do, so the export drops it.",
  },
];

/* `.d.ts` files carry no behaviour, so they are filtered here rather than
 * exempted above -- an exemption entry that matches nothing is indistinguishable
 * from a stale one, and `src/` has no declaration files today. */
const SOURCES = ALL.filter((f) => !isTest(f.rel) && !isDecl(f.rel));

const exempt = (r: string) => EXEMPT.some((e) => e.pattern.test(r));

/* A COMPONENT DECLARATION: `function Name(`, `export function Name(`,
 * `export default function Name(`, or a `const Name = (`/`= function` arrow.
 * A PascalCase const holding a plain object or array -- `const M = {`,
 * `const VIEWS: View[] = [` -- is data, not a component, and does not match. */
const COMPONENT =
  /^(?:export\s+)?(?:default\s+)?function\s+[A-Z]|^(?:export\s+)?const\s+[A-Z][A-Za-z0-9]*(?:\s*:[^=]+)?\s*=\s*(?:\(|function)/gm;

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

  it("no view imports a sibling view, except the shell that hosts them", () => {
    // Report composes the three; the three know nothing about each other.
    const wrong = SOURCES.flatMap((f) => {
      const from = viewOf(f.rel);
      if (!from || from === "Report") return [];
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

  it("Report imports the views it hosts", () => {
    // The carve-out above is only sound if the shell is the thing using it.
    const report = SOURCES.find((f) => f.rel === "views/Report/Report.tsx")!;
    const hosted = imports(report.text).filter((s) => /View\/\w+View$/.test(s));
    expect(hosted.length).toBe(3);
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
     * to views/Report/data and `calendarRows` to views/CalendarView/data. */
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
