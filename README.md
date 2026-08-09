# Training report card — public demo

A generated, public mirror of one athlete's training report card: **adherence**
(did the prescribed sessions get run the way they were prescribed) and **load**
(what the whole week cost, running plus the walking and standing between runs),
graded from Garmin/Runalyze data and daily step exports.

The data is real — Micah's, five graded weeks of it. The surname
is withheld and so is every internal identifier; nothing here is synthetic.

## This repo is generated

The graders, the raw payloads, the week manifests and the hand-authored notes
live in a **private** repository. A script there writes this one:

```
athletes/<slug>/published/   the read model -- directories are tables, files are rows
web/                         the Next.js app, copied from the private repo, unmodified
                             except for the two lines that make a static export possible
```

Nothing here is edited by hand, so a pull request against it would be
overwritten by the next export.

## Running it locally

```bash
cd web
npm install
npm run dev      # then open the printed URL
npm run check    # typecheck + lint + tests, and not one subprocess
```

A built copy is served from `/training-demo`, because a GitHub Pages project site
lives under its repo name. **Development serves from the root instead** — a
basePath otherwise applies to `next dev` too, and the URL Next prints on startup
would 404. `next.config.ts` is a function of the build phase for that one
reason.

Run `npm run dev` or `npm run build` before `npm run check` on a fresh clone:
Next generates the route types the layout uses during a build, and the
typecheck cannot see them until it has.

## How it is deployed

`.github/workflows/pages.yml` runs the checks, builds a static export
(`output: "export"`, `basePath: "/training-demo"`) and publishes `web/out` to
GitHub Pages on every push.

## What is in the app

- **Week** — the two headline scores, every run beside its prescription, the rep
  tables for workout sessions, the per-day load decomposition and the readiness
  checks, plus the hand-authored note for that week
- **Calendar** — daily steps, with the derived step-equivalent ceiling and any
  breach drawn on top
- **Trends** — weekly mileage, quality share, total load, resting heart rate and
  HRV over as much history as exists

Charts are hand-written inline SVG. There is no charting dependency, no web
font, and no request to a third party: the page renders resting heart rate,
HRV, sleep and weight, and owes those to nobody.
