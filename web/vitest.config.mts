import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `.mts`, not `.ts`: this file is ESM, and Vite's native config loader reads a
// bare `.ts` here as CommonJS and warns that `__dirname` will stop working.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // `server-only` THROWS BY DESIGN when imported outside a server component:
      // its package maps `.` to `empty.js` only under the `react-server`
      // condition, and to a module whose body is `throw new Error(...)`
      // otherwise. Vitest resolves neither condition, so without this alias
      // `lib/data/loadPayload.ts` -- and therefore `app/page.tsx` -- cannot be
      // imported by a test at all. Pointed at the same empty module Next uses,
      // so the marker keeps working in the app and disappears in the suite.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    // Two environments, split by file extension.
    //
    // `.test.ts` is pure logic in node -- the formatters, the scales, the
    // payload contract. That is where the real coverage is, per the repo's
    // standing rule that pure logic is extracted and tested generously.
    //
    // `.test.tsx` renders components under jsdom, and exists for ONE reason:
    // both bugs this port was defending against (`set.band` read as a pair,
    // 0.0 filtered as falsy) lived in component code reading the payload, and
    // no amount of testing the formatters would have caught either. It is a
    // smoke test against the real committed payload, not a UI spec.
    projects: [
      {
        extends: true,
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.test.ts"],
          // Its OWN pool, so its node-environment files never land on a worker
          // that has a jsdom set up. One shared pool makes every alternation
          // tear the window down and build it again, which cost more than the
          // whole logic project takes to run.
          pool: "forks",
          // Two workers, not one per core -- 280 tests in well under a second.
          maxWorkers: 2,
          // The two projects run one after the other rather than at once.
          // Sharing the machine, two full-width pools oversubscribe it and the
          // jsdom side spends its time waiting: 27s together against 11s in
          // sequence. Vitest requires distinct group orders once the pools
          // differ, which is what makes the split explicit rather than
          // incidental.
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "render",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          pool: "threads",
          sequence: { groupOrder: 1 },
          // ONE jsdom per worker, reused across files. Standing up a fresh
          // window for each of ~55 files costs more than every assertion in
          // them put together -- it took the suite from 6s to 50s when the
          // components were split out of four big files into one file each.
          //
          // The cost of reuse is that globals leak between files. Every render
          // test already cleans up its own tree, and the two suites that touch
          // shared state -- the viewport in TooltipProvider, `data-theme` in
          // the theme tests -- restore it explicitly. A new test that mutates a
          // global must do the same.
          isolate: false,
        },
      },
    ],
  },
});
