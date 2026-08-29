"use client";

import { Banner } from "@/lib/ux/primitives/Banner";
import { IndexGate } from "@/lib/wasmdb/IndexGate";
import { validatePayload } from "@/lib/data/payload";
import { trendsSlice } from "@/lib/query/slices";
import { TrendsView } from "./TrendsView";

/* Every week, projected -- queried from the browser's own index.
 *
 * NO ROUTE PARAMETER, exactly as on the server. Trends' window is a pair of
 * dates the reader drags across the whole record, and every panel needs the
 * whole series before it can be clipped: the window decides what is DRAWN, not
 * what is fetched.
 *
 * The projection is the SAME allowlist the server ships -- `trendsSlice` is one
 * function -- so what this draws cannot differ from what the private app draws.
 * That matters more here than the byte count does: this route reads all 102
 * weeks either way, and it is the one place a second implementation of the
 * projection would be invisible until a panel came up empty.
 */
export function TrendsClientRoute() {
  return (
    <IndexGate>
      {(db) => {
        const loaded = validatePayload(trendsSlice(db));
        if (!loaded.ok) {
          return (
            <Banner stop>
              <b>Nothing to show. </b>
              {loaded.error}
            </Banner>
          );
        }
        return <TrendsView payload={loaded.payload} />;
      }}
    </IndexGate>
  );
}
