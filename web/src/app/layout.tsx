import type { Metadata } from "next";

import { BUNDLE_URL, STATIC_DATA } from "@/lib/data/staticData";
import { IndexProvider } from "@/lib/wasmdb/IndexProvider";
import { loadShell } from "@/lib/data/loadPayload";
import { ReportShell } from "@/views/Report/ReportShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Training report card",
  description: "Adherence and load, graded from the source data on every load.",
};

/* THE SHELL LIVES HERE, NOT IN A PAGE, and that is what makes the routes cheap.
 *
 * A layout is rendered once and PRESERVED across navigations within its
 * segment tree, so stepping from one week to the next re-renders the card and
 * not the top bar, the week field or the tab strip. Repeating the shell in each
 * page would rebuild all of it on every click and lose the field's focus with
 * it.
 *
 * It reads `loadShell()` -- the athlete, the week key list, the two counts and
 * where to open -- which is a handful of scalars rather than a payload. Giving
 * the shell a payload would hand it reach into every week, which is the thing
 * the routes exist to stop.
 *
 * IT READS THAT AT BUILD TIME IN THE STATIC EXPORT, WHICH IS WHY THE SHELL DOES
 * NOT WAIT. The demo has the published tree on disk when `next build` runs, so
 * the top bar, the week picker and the tab strip are prerendered with real
 * data and paint with no fetch at all. Only the card in the middle waits on the
 * browser index -- and `IndexProvider` sits HERE rather than in a page so that
 * a navigation queries an index that is already open.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  const shell = loadShell();

  /* THE PROVIDER IS MOUNTED ONLY IN THE STATIC EXPORT. In the private app every
     route reads `node:sqlite` on the server, so opening a second index in the
     browser would download 703 KB to answer questions already answered -- and
     `STATIC_DATA` being a build-time constant is what lets the bundler drop the
     whole wasm import graph from that build rather than merely not running it. */
  const withIndex = (ui: React.ReactNode) =>
    STATIC_DATA ? <IndexProvider url={BUNDLE_URL}>{ui}</IndexProvider> : ui;

  // No `next/font/google`. The scaffold's Geist import fetches from Google at
  // BUILD time, and the type stack is already decided: `--sans` in globals.css
  // is the system font stack the standalone page used, chosen so the page owed
  // nothing to the network. Nothing here should reach a third party -- this
  // renders resting heart rate, HRV, sleep and weight.
  return (
    <html lang="en">
      <body>
        {shell.ok ? (
          withIndex(<ReportShell shell={shell.shell}>{children}</ReportShell>)
        ) : (
          /* NO CHILDREN. Without an athlete there is nothing for a page to
             render, and every one of them would repeat this same sentence. */
          <main>
            <div className="banner stop">
              <b>Nothing to show. </b>
              {shell.error}
            </div>
            <p className="note">
              This page reads <code>athletes/&lt;slug&gt;/published/</code>,
              which is written by <code>python scripts/publish.py</code>. Run
              that from the repo root, then refresh.
            </p>
          </main>
        )}
      </body>
    </html>
  );
}
