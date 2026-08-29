"use client";

import { useSearchParams } from "next/navigation";

import { IndexGate } from "@/lib/wasmdb/IndexGate";
import { validatePayload } from "@/lib/data/payload";
import { calendarSlice } from "@/lib/query/slices";
import { CalendarRoute } from "./CalendarRoute";
import { resolveAnchor } from "./data/window";

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
 */
export function CalendarClientRoute({
  defaultAnchor,
}: {
  defaultAnchor: string | null;
}) {
  const params = useSearchParams();
  const end = resolveAnchor(params.get("end") ?? undefined, defaultAnchor);

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
            loaded={checked.ok ? { ...checked, maxSteps } : checked}
          />
        );
      }}
    </IndexGate>
  );
}
