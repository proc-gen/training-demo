<!-- GENERATED MIRROR. This file is written by `scripts/export_demo.py` in a private repository; edits here are overwritten by the next export. -->

# The training report card

A Next.js app that **reads published records off disk**. It runs no Python — the graders are a
separate toolchain that writes `athletes/<slug>/published/` ahead of time.

```bash
npm install       # once per machine -- node_modules/ is gitignored, like .venv/
npm run dev       # then open the printed URL
npm run check     # typecheck + lint + tests, and not one subprocess
```

Change a manifest, a note or a threshold, then:

```bash
python scripts/publish.py    # from the repo root
```

and refresh. The records are read on every request, so nothing needs restarting.

## How it gets its data

`athletes/<slug>/published/` is a **read model, decomposed into records** — directories are tables,
files are rows:

```
published/
  index.json                     the catalog: identity, banners, which weeks and days exist
  history.json  thresholds.json
  series/adherence.json  series/load.json
  weeks/<week-start>/week.json         manifest + pace chart + either grader's error
  weeks/<week-start>/adherence.json    grade_week.py --json, VERBATIM -- ABSENT when it failed
  weeks/<week-start>/load.json         grade_load.py --json, VERBATIM
  weeks/<week-start>/notes-*.html      the rendered notes
  days/<date>.json                     one day of steps + wellness
```

`lib/repository.ts` reads it and is a port of `unpublish()` in `scripts/publish.py`. Both are
pure structural merges — nothing in either computes a date, resolves a band or supplies a default —
and the Python suite round-trips `publish`/`unpublish` against the real payload leaf for leaf, so
what that test pins is what this app assembles.

**This app adds no data logic of its own.** If a number is not in the records it is not shown,
because a second implementation of a scoring rule is exactly the drift the report card exists to
remove.

**Resolving an athlete is two cases here and must stay two**: an explicit `?athlete=<slug>`, or the
sole athlete that has published anything. Python's `resolve_athlete()` has five, because a CLI is
handed paths and anchors; neither idea exists over HTTP. It is duplicated verbatim across four Python
modules and `tests/test_athlete_paths.py` compares all four function by function — a TypeScript copy
would be a fifth that no test could keep honest.

- `src/app/page.tsx` — server component, renders with the data already in hand
- `src/app/api/data/route.ts` — the same payload over HTTP, for `curl`-ing when a number looks wrong

## Where the logic lives

Anything that decides a **number** is in `src/lib/` and is tested. Anything that decides **markup**
is in `src/components/` and mostly is not — the repo's standing rule is that the framework-coupled
layer stays as thin as possible.

| file | what |
|---|---|
| `lib/repo.ts` | finds the repo by walking up for `athletes/`; no absolute path is ever written down |
| `lib/repository.ts` | reads the published records — the port of `unpublish()`, and the data-access boundary |
| `lib/data.ts` | `loadPayload()` — assemble, then validate |
| `lib/payload.ts` | zod schema, TS types via `z.infer`, validated against real grader output |
| `lib/format.ts` | clocks, paces, percentages |
| `lib/scales.ts` | chart scale arithmetic |
| `lib/weeks.ts` | week selection and the calendar grid |

The exception is `src/components/render.test.tsx`, which renders every view against the **committed
published tree** — the rich payload a checkout without `athletes/<slug>/raw/` cannot regenerate. It
exists because both bugs this port was defending against lived in component code: `set.band` read as
a `[lo, hi]` pair when it is a name, and `0.0` filtered away as falsy when it means "dead on
prescription". Assembling through `repository.ts` means every one of those cases exercises the reader
too.

When a database replaces the files, `lib/repository.ts` becomes queries and nothing above it moves.
That is why the tree is decomposed rather than shipped as one blob, and why `node:fs` appears in no
other module — a test asserts it.

## Things not to change back

- **`globals.css` is the only copy of the palette.** It was carried verbatim from the standalone
  page's stylesheet, which was retired on 2026-08-07. Those hex values are measurements — the
  categorical slots were validated for colour-vision deficiency in both light and dark. The Tailwind
  `@theme inline` block points at them rather than restating them, and a Tailwind config that re-typed
  them would be a transcription of a measurement.
- **Markdown is rendered in Python**, not here. The notes are converted to HTML by
  `publish.py` and published as `.html` records. Do not add a JS markdown renderer.
- **Charts are hand-written SVG.** npm is available, but the existing code encodes the tick
  ceiling, one-scale-per-panel and the steps-vs-SE calendar decision, each of which cost a bug.
- **Nothing is cached.** Route handlers are uncached by default in Next 16 and `force-dynamic` is
  set on top. Enabling `cacheComponents` would freeze whatever was published when `next build` ran.
- **No subprocess, ever.** `tests/test_web_segregation.py` fails on `child_process`, `execFile`, a
  bare `spawn(`, an npm script that shells out to Python, or a dependency whose job is starting a
  process. Naming `python scripts/publish.py` in *error text* is fine and deliberate — that is
  the most useful thing the page can say when nothing has been published.

See the repo root `CLAUDE.md` for the rest.
