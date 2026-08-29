"use client";

import { IndexGate } from "@/lib/wasmdb/IndexGate";
import { validatePayload } from "@/lib/data/payload";
import { weekSlice } from "@/lib/query/slices";
import { WeekRoute } from "./WeekRoute";

/* One week, queried from the browser's own index. The static export's half.
 *
 * IT IS THE SERVER ROUTE WITH ONE LINE CHANGED, and that is the design: the
 * server calls `weekSlice(openIndex(slug), start)` and this calls
 * `weekSlice(db, start)` on a handle sqlite-wasm built from the shipped
 * records. Same SQL, same validator, same `WeekRoute` underneath --
 * `lib/wasmdb/adapter.test.ts` asserts the two engines answer this slice
 * identically over the committed tree.
 *
 * WHY IT EXISTS AT ALL: GitHub Pages runs nothing, so the export used to bake
 * each of 102 week slices into its own HTML and its own RSC payload. This route
 * is a ~5 KB shell instead, and a reader who has already loaded the index pays
 * ~1 ms to move between weeks.
 */
export function WeekClientRoute({ start }: { start: string }) {
  return (
    <IndexGate>
      {(db) => <WeekRoute start={start} loaded={validatePayload(weekSlice(db, start))} />}
    </IndexGate>
  );
}
