"use client";

import { useSearchParams } from "next/navigation";

import { IndexGate } from "@/lib/wasmdb/IndexGate";
import { validatePayload } from "@/lib/data/payload";
import { calendarSlice } from "@/lib/query/slices";
import { CalendarRoute } from "./CalendarRoute";
import { resolveMode } from "./data/mode";
import { resolveAnchor, resolveWeeks } from "./data/window";

/* The calendar window, queried from the browser's own index.
 *
 * IT READS `?end=` ITSELF, unlike the other two client routes. On the server
 * the route reads `searchParams` and hands the anchor down; a static export has
 * one HTML file for `/calendar` and the parameter only exists in the browser --
 * which is precisely why the anchor is a query parameter rather than a segment.
 * A segment would have to be enumerated by `generateStaticParams`, and that
 * enumeration is what bounded the demo at twenty-six weeks either side of the
 * record while `stepLastDay` was deliberately unbounded. Any anchor works here
 * now, including one past the plan: an honest grid of empty cells.
 *
 * `resolveAnchor` IS THE SAME FUNCTION THE SERVER ROUTE CALLS, so validation
 * and Sunday-normalisation cannot differ between the two builds.
 *
 * `defaultAnchor` ARRIVES AS A PROP rather than being read here, because it is
 * a fact about the RECORD -- the newest measured date, chosen in SQL -- and the
 * shell already has it. Deriving it a second time in the browser would be the
 * third implementation of a rule this app states in one place on purpose.
 *
 * AND SO DOES `today`, FOR A STRONGER VERSION OF THE SAME REASON. It is the
 * app's one wall-clock read and it happens on the server, in the route above
 * -- `runStatus.ts` records that a hook reading it HERE was deleted. In this
 * build the page is `force-static`, so what arrives is the BUILD date: the
 * honest answer for a frozen snapshot, and this file must not "fix" that by
 * reaching for `new Date()` on the client.
 */
export function CalendarClientRoute({
  defaultAnchor,
  today,
}: {
  defaultAnchor: string | null;
  /** The date the Plan grid marks up to. A PROP, never a clock read here. */
  today: string | null;
}) {
  const params = useSearchParams();
  const end = resolveAnchor(params.get("end") ?? undefined, defaultAnchor);
  /* THE SAME RESOLVER THE SERVER ROUTE CALLS, for the reason `resolveAnchor`
     is: a link means one thing, and two spellings of "what does ?mode= say" is
     how a strip comes to highlight one mode while the other renders. */
  const mode = resolveMode(params.get("mode") ?? undefined);
  /* AND THE SAME FOR THE WEEK COUNT, which became a parameter on 2026-09-07
     because as state it reset on every step of the window. */
  const weeks = resolveWeeks(params.get("weeks") ?? undefined);

  if (!end) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>No day has been published for this athlete.
      </div>
    );
  }

  return (
    <IndexGate>
      {(db) => {
        const { payload, maxSteps } = calendarSlice(db, end);
        const checked = validatePayload(payload);
        return (
          <CalendarRoute
            end={end}
            mode={mode}
            weeks={weeks}
            today={today}
            loaded={checked.ok ? { ...checked, maxSteps } : checked}
          />
        );
      }}
    </IndexGate>
  );
}
