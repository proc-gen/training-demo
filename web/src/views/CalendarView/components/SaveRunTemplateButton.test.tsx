import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { SaveRunTemplateButton } from "./SaveRunTemplateButton";

afterEach(cleanup);

const run = {
  key: "2026-09-08-pm",
  date: "2026-09-08",
  runalyze_id: 42,
  prescription_source: "the sheet",
  role: "subt",
  prescribed: "PM: 12x600m w/ 200m jog at Sub-T",
  reps: 12,
};

/** A fetcher recording every POST body. */
function fake(
  body: Record<string, unknown> = { ok: true, id: "subt-1", duplicate: false },
  status = 200,
) {
  const posts: Record<string, unknown>[] = [];
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json(body, { status });
  }) as unknown as typeof fetch;
  return { fetcher, posts };
}

describe("SaveRunTemplateButton", () => {
  it("posts the run NARROWED -- no key, no date, no runalyze id", async () => {
    /* The contract the whole feature rests on, asserted at the point the
       request leaves the browser as well as at the route. */
    const { fetcher, posts } = fake();
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    fireEvent.click(q.getByText("Save as template"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].run).toEqual({
      role: "subt",
      prescribed: "PM: 12x600m w/ 200m jog at Sub-T",
      reps: 12,
    });
  });

  it("says which template it became", async () => {
    const { fetcher } = fake();
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    fireEvent.click(q.getByText("Save as template"));
    expect((await q.findByText("Saved as subt-1")).className).not.toContain(
      "stop",
    );
  });

  it("treats a second press as a clean outcome, not a failure", async () => {
    /* Pressing this twice on one run is ordinary; a second identical row would
       show the picker the same line twice with no way to tell them apart. */
    const { fetcher } = fake({ ok: true, id: "subt-1", duplicate: true });
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    fireEvent.click(q.getByText("Save as template"));
    expect((await q.findByText("Already saved as subt-1")).className).not.toContain(
      "stop",
    );
  });

  it("reports a refusal in the critical colour", async () => {
    const { fetcher } = fake({ error: "the athlete does not resolve" }, 500);
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    fireEvent.click(q.getByText("Save as template"));
    const status = await q.findByText("the athlete does not resolve");
    expect(status.className).toContain("stop");
  });

  it("REFUSES while the workout table is blocked, and says why", async () => {
    /* A run whose rows cannot be collapsed keeps its LAST GOOD value, so
       saving then would file a template of something other than what the table
       shows -- the reason `SaveBar` disables the day's own save. */
    const { fetcher, posts } = fake();
    const { q } = wrap(
      <SaveRunTemplateButton
        run={run}
        blocked={["a set may be optional, or its reps may be, but not both"]}
        fetcher={fetcher}
      />,
    );
    const button = q.getByText("Save as template") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toContain("cannot be written");
    fireEvent.click(button);
    expect(posts).toHaveLength(0);
  });

  it("is a ghost button, not the form's accent submit", async () => {
    /* `--accent` is the DAY's save. A second filled control in the same head
       would read as the primary action of the run. */
    const { fetcher } = fake();
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    expect(q.getByText("Save as template").className).toBe("ghost");
  });

  it("shows nothing at all before it is pressed", () => {
    const { fetcher } = fake();
    const { container } = wrap(
      <SaveRunTemplateButton run={run} fetcher={fetcher} />,
    );
    expect(container.querySelector(".edit-tpl-status")).toBeNull();
  });

  it("survives a fetch that throws rather than leaving the head empty", async () => {
    const fetcher = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const { q } = wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    fireEvent.click(q.getByText("Save as template"));
    expect((await q.findByText("offline")).className).toContain("stop");
  });

  it("does not post until it is pressed", () => {
    /* The picker loads on open; this one must not fetch on render, or every
       run in a day would hit the route on the dialog's first paint. */
    const fetcher = vi.fn() as unknown as typeof fetch;
    wrap(<SaveRunTemplateButton run={run} fetcher={fetcher} />);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
