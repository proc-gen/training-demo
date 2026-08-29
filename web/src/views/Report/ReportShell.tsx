"use client";

import { usePathname, useRouter } from "next/navigation";

import type { Shell } from "@/lib/query/slices";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { TopBar } from "./components/TopBar";
import { ViewTabs } from "./components/ViewTabs";
import { WeekPicker } from "./components/WeekPicker";
import { viewOfPath, weekOfPath } from "./data/routes";

/** The report card's chrome: who, which view, and which week.
 *
 * IT WAS `Report.tsx` AND HELD THE WHOLE APP'S STATE. Two `useState` hooks
 * chose the view and the week, which meant the server had to send every week's
 * data on every request so the browser could pick one -- 3,290 KB to render
 * 68.7 KB of it. The choice is a ROUTE now, so the server sends one week.
 *
 * WHAT WAS LOST AND WHAT REPLACED IT. `Report` re-keyed `<WeekView>` on the
 * selected week so that changing week reset the card -- the tab, the expanded
 * rows, the chart toggles and the open score bar. A route change is a new tree,
 * so all five reset for free and the `key` is gone with the state that needed
 * it. `ReportShell.test.tsx` pins the reset, because a property that arrives
 * for free is one nobody notices losing.
 *
 * THE CURRENT VIEW COMES FROM THE PATH, NOT FROM STATE. `usePathname()` is the
 * single source, so the tab strip cannot highlight one view while another is
 * rendered -- which is exactly the class of defect `autoComplete="off"` exists
 * to prevent one level down.
 *
 * `useRouter().push` RATHER THAN `next/link`. The demo is served from a project
 * page under a `basePath`, and the router applies it automatically -- but so
 * would `Link`. What decides it is that `Tabs` and `Stepper` are accessible
 * controls with their `role`, `aria-selected` and `aria-pressed` wiring already
 * right, and re-expressing them as anchors would mean rebuilding that wiring in
 * two places to gain a middle-click this page has never had.
 */
export function ReportShell({
  shell,
  children,
}: {
  shell: Shell;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const view = viewOfPath(pathname);
  /* On `/` the path names no week, and the week being rendered is the default
     the SERVER chose. The picker must show that one or it would sit blank
     above a card that is plainly about a week. */
  const selected = weekOfPath(pathname) ?? shell.defaultWeek;

  return (
    <TooltipProvider>
      <TopBar
        athlete={shell.athlete}
        weekCount={shell.weekCount}
        dayCount={shell.dayCount}
      />

      {/* One filter row above everything it scopes, never inside a card. */}
      <div className="filters">
        <WeekPicker
          keys={shell.weekKeys}
          selected={selected}
          onSelect={(key) => router.push(`/week/${key}`)}
          hidden={view !== "week"}
        />
        <ViewTabs
          view={view}
          onSelect={(next) => {
            if (next === "week") router.push(selected ? `/week/${selected}` : "/");
            else if (next === "calendar") {
              /* The anchor the SERVER chose -- the newest measured date, never
                 a browser clock. `window.ts` gives that reasoning at length. */
              router.push(
                shell.defaultCalendarAnchor
                  ? `/calendar?end=${shell.defaultCalendarAnchor}`
                  : "/calendar",
              );
            } else router.push("/trends");
          }}
        />
      </div>

      <main>{children}</main>
    </TooltipProvider>
  );
}
