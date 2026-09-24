<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The report card app

**The app's own rules are `docs/web-app.md` in the private repo** — the source tree and what decides
where a file goes, one component per file, the test-beside-the-file rule, the vitest pools and what
jsdom cannot do, the SQLite index across `lib/query` / `lib/db` / `lib/wasmdb`, Custom Laps, the plan
editor, the workout table, the charts and the palette. Read it before changing anything under `src/`.

Rules that bind code **outside** `web/` — the four Python-to-TypeScript port pins, the `publish.py`
save flow, and the `docs/data-model.md` membership rule — are in the repo-root `CLAUDE.md`
§ *The `web/` app*.

> Anything written here is mirrored into the public demo repo by `scripts/export_demo.py`, which is
> why this file carries the pointer and not the rules. Keep additions here to that shape.
>
> Everything above the `END:nextjs-agent-rules` marker is rewritten by `next dev`. Add nothing inside
> that block; content outside it is preserved.
