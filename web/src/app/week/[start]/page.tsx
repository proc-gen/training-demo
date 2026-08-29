import { STATIC_DATA } from "@/lib/data/staticData";
import { loadShell, loadWeek } from "@/lib/data/loadPayload";
import { WeekClientRoute } from "@/views/WeekView/WeekClientRoute";
import { WeekRoute } from "@/views/WeekView/WeekRoute";

/* One named week.
 *
 * THE ROUTE IS THE QUERY. In the private app this reads one row out of the
 * index -- 0.2 ms, 68.7 KB -- against the 88 ms and 3,290 KB it took to ship
 * every week so the browser could choose one.
 *
 * `generateStaticParams` IS FOR THE DEMO AND NOTHING ELSE. `force-dynamic`
 * ignores it here; the public export patches that line to `force-static`, and
 * then this list is what tells the build which pages to write. The demo has no
 * server, so a URL that was not built does not exist -- which is why the list
 * has to be every week rather than a sample.
 *
 * WHAT IT WRITES IS NOW A ~5 KB SHELL, not the week. Under `STATIC_DATA` the
 * page renders a CLIENT wrapper that queries the browser's own index, so the
 * 102 prerendered pages carry markup and no data -- against ~140 KB each when
 * the slice was baked into the HTML and its RSC payload. The URLs are
 * unchanged, which is what keeps deep links working on both sides.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

export function generateStaticParams() {
  const shell = loadShell();
  return shell.ok ? shell.shell.weekKeys.map((start) => ({ start })) : [];
}

export default async function Page({ params }: PageProps<"/week/[start]">) {
  const { start } = await params;
  if (STATIC_DATA) return <WeekClientRoute start={start} />;
  return <WeekRoute start={start} loaded={loadWeek(start)} />;
}
