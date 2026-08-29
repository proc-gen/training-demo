/* ONE `next/navigation` mock, shared by every test file that needs one.
 *
 * WHY IT EXISTS: the render project runs with `isolate: false` -- one jsdom and
 * one module registry per worker, which is what took the suite from 50s to 10s
 * when the components were split apart. A `vi.mock("next/navigation", ...)`
 * therefore is NOT file-scoped in practice: whichever factory the worker
 * registers first answers for every file it later loads. Eight files mocked
 * that module with four different shapes, and each carried its OWN hoisted
 * `push` spy -- so a file whose mock lost simply never saw its spy called.
 *
 * IT PRESENTED AS FLAKINESS, which is the worst way for a real problem to
 * present: `ReportShell.test.tsx` and `CalendarView.test.tsx` failed together
 * on roughly one run in three, passed alone every time, and passed in pairs.
 * Every instinct says re-run. Same shape as the render pool's uncapped workers
 * blowing the 5s timeout, and the same conclusion: fix the cause, do not raise
 * the tolerance.
 *
 * THE FIX IS THAT EVERY FACTORY RETURNS THE SAME OBJECT. A collision then
 * cannot matter, because there is nothing to collide with -- whichever
 * registration wins, the behaviour is identical and the state lives here. Each
 * file still writes its own `vi.mock` line (the call is hoisted per module and
 * cannot be shared), but the line is always the same one:
 *
 *     vi.mock("next/navigation", async () =>
 *       (await import("@/test/navigation")).navigation());
 *
 * `structure.test.ts` pins that no test file builds its own.
 *
 * RESET WITH `resetNavigation()` in a `beforeEach`. Shared state across files
 * in one worker is the price of the shared registry, and a case that read the
 * previous file's pathname would be exactly the bug this replaces.
 */

import { vi } from "vitest";

/** Where `router.push()` calls land. Asserted directly by callers. */
export const push = vi.fn();

/** What `usePathname()` returns. Set it per case. */
let pathname = "/";

/** What `useSearchParams()` returns. Set it per case. */
let search = new URLSearchParams();

export function setPathname(value: string): void {
  pathname = value;
}

export function setSearch(value: URLSearchParams | Record<string, string>): void {
  search = value instanceof URLSearchParams ? value : new URLSearchParams(value);
}

/** Back to a bare `/` with no parameters and no recorded navigation. */
export function resetNavigation(): void {
  push.mockClear();
  pathname = "/";
  search = new URLSearchParams();
}

/** The module `next/navigation` is replaced with. */
export function navigation() {
  return {
    useRouter: () => ({ push }),
    usePathname: () => pathname,
    useSearchParams: () => search,
  };
}
