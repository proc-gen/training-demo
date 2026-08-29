import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { athleteSlugs } from "@/lib/repository";
import { openIndex } from "@/lib/db/open";
import { shellSlice } from "@/lib/query/slices";
import Page, { dynamic, generateStaticParams } from "./page";

afterEach(cleanup);

const slug = athleteSlugs()[0];
const shell = slug ? shellSlice(openIndex(slug)) : null;

describe("the route's caching", () => {
  it("is force-static, because this mirror is a static export", () => {
    /* THE EXPORT PATCHES THIS. The private repo declares `force-dynamic`,
     * where each route re-reads the published tree per request. A static
     * export has no server to re-read anything -- the records are baked in
     * at build time. */
    expect(dynamic).toBe("force-static");
  });
});

describe("generateStaticParams", () => {
  /* IT IS FOR THE DEMO AND NOTHING ELSE. `force-dynamic` ignores it here; the
   * public export patches that line to `force-static`, and then this list is
   * what tells the build which pages to write. The demo has no server, so a URL
   * that was not built does not exist -- which is why the list has to be every
   * week rather than a sample. */

  it.skipIf(!slug)("names every week in the record", () => {
    const params = generateStaticParams();
    expect(params.map((p) => p.start)).toEqual(shell!.weekKeys);
  });

  it.skipIf(!slug)("names more than a handful, so it is not a sample", () => {
    expect(generateStaticParams().length).toBeGreaterThan(10);
  });
});

describe("Page", () => {
  it.skipIf(!slug)("renders the week its segment names", async () => {
    const start = shell!.defaultWeek!;
    const { container } = render(
      await Page({ params: Promise.resolve({ start }), searchParams: Promise.resolve({}) }),
    );
    expect(container.textContent).toContain("Week of " + start);
  });

  it.skipIf(!slug)("renders a DIFFERENT week for a different segment", async () => {
    /* Guards the segment actually reaching the query. A route that ignored its
       param would render the default week under every URL and look perfectly
       fine on the one page anybody checked. */
    const graded = shell!.weekKeys.filter((k) => k !== shell!.defaultWeek);
    expect(graded.length).toBeGreaterThan(0);
    const other = graded[graded.length - 1];

    const a = render(
      await Page({ params: Promise.resolve({ start: shell!.defaultWeek! }), searchParams: Promise.resolve({}) }),
    ).container.textContent;
    cleanup();
    const b = render(
      await Page({ params: Promise.resolve({ start: other }), searchParams: Promise.resolve({}) }),
    ).container.textContent;

    expect(a).toContain("Week of " + shell!.defaultWeek);
    expect(b).toContain("Week of " + other);
    expect(a).not.toBe(b);
  });

  it.skipIf(!slug)("reports a week the record does not carry", async () => {
    const { container } = render(
      await Page({ params: Promise.resolve({ start: "1999-01-04" }), searchParams: Promise.resolve({}) }),
    );
    expect(container.textContent).toContain("No such week");
  });
});
