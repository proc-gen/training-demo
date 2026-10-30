import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { RegradeButton } from "./RegradeButton";

afterEach(cleanup);

/* Every case injects a fetcher -- no network, no module registry. */
const respond = (status: number, body: unknown) =>
  vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

const clean = (weeks: string[]) =>
  respond(200, {
    ok: true,
    publish: { seconds: 13.6 },
    weeks: weeks.map((week_start) => ({
      week_start,
      found: true,
      adherence_error: null,
      load_error: null,
    })),
  });

function render(over: Partial<Parameters<typeof RegradeButton>[0]> = {}) {
  return wrap(
    <RegradeButton
      pending={["2026-10-12", "2026-10-19"]}
      onDone={() => {}}
      disabled={false}
      fetcher={clean(["2026-10-12", "2026-10-19"])}
      {...over}
    />,
  ).container;
}

const button = (c: HTMLElement) => c.querySelector("button")!;
const status = (c: HTMLElement) =>
  c.querySelector(".edit-saverow p")?.textContent ?? null;

async function press(c: HTMLElement) {
  await act(async () => {
    fireEvent.click(button(c));
  });
}

describe("RegradeButton -- at rest", () => {
  it("says how many weeks are waiting", () => {
    expect(status(render())).toBe("2 weeks have changes not yet graded.");
  });

  it("uses the singular for one week", () => {
    expect(status(render({ pending: ["2026-10-12"] }))).toBe(
      "1 week has changes not yet graded.",
    );
  });

  it("names the pending weeks in its tooltip", () => {
    expect(button(render()).getAttribute("title")).toBe("Grade 10/12, 10/19");
  });

  it("is the filled accent -- it is the control that writes", () => {
    expect(button(render()).className).toBe("save");
  });

  it("keeps one fixed label", () => {
    expect(button(render()).textContent).toBe("Regrade");
  });

  it("is DISABLED with nothing pending, and says so", () => {
    const c = render({ pending: [] });
    expect(button(c).disabled).toBe(true);
    expect(button(c).getAttribute("title")).toBe("Every week is graded");
    expect(status(c)).toBeNull();
  });

  it("RENDERS DISABLED in the demo rather than vanishing", () => {
    const c = render({ disabled: true });
    expect(button(c).disabled).toBe(true);
    expect(button(c).getAttribute("title")).toContain("demo is read-only");
  });

  it("does not fire when disabled", async () => {
    const fetcher = clean([]);
    const c = render({ disabled: true, fetcher });
    await press(c);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("raises no banner before it has run", () => {
    expect(render().querySelector(".banner")).toBeNull();
  });
});

describe("RegradeButton -- pressed", () => {
  it("posts ONE publish, whatever the count", async () => {
    const fetcher = clean(["2026-10-12", "2026-10-19"]);
    const c = render({ fetcher });
    await press(c);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = (fetcher as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls[0][1];
    expect(JSON.parse(String(init.body))).toEqual({ scope: "publish" });
  });

  it("says GRADING while it waits, and disables itself", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = (async () => {
      await gate;
      return Response.json({ ok: true, publish: { seconds: 1 }, weeks: [] });
    }) as unknown as typeof fetch;
    const c = render({ fetcher });
    act(() => {
      fireEvent.click(button(c));
    });
    expect(status(c)).toContain("Grading 2 weeks");
    expect(button(c).disabled).toBe(true);
    expect(button(c).textContent).toBe("Regrade");
    await act(async () => {
      release();
      await gate;
    });
  });

  it("reports a clean regrade with its duration, and refreshes the page", async () => {
    const onDone = vi.fn();
    const c = render({ onDone });
    await press(c);
    expect(status(c)).toBe("Regraded in 13.6s.");
    expect(c.querySelector(".banner")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("NAMES each week the grader refused, with every sentence", async () => {
    const onDone = vi.fn();
    const c = render({
      onDone,
      fetcher: respond(200, {
        ok: true,
        publish: { seconds: 13.6 },
        weeks: [
          { week_start: "2026-10-12", found: true, adherence_error: null, load_error: null },
          {
            week_start: "2026-10-19",
            found: true,
            adherence_error: "grade_week.py exited 1: unknown role",
            load_error: "grade_load.py exited 1: bad date",
          },
        ],
      }),
    });
    await press(c);
    const banner = c.querySelector(".banner.stop")!;
    expect(banner.textContent).toContain("refused a week");
    expect(banner.textContent).toContain("plans are written");
    const items = [...banner.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual([
      "Week of 10/19: grade_week.py exited 1: unknown role grade_load.py exited 1: bad date",
    ]);
    // The tree moved anyway, so the page still re-reads it.
    expect(onDone).toHaveBeenCalledTimes(1);
    // The clean-run sentence is not ALSO shown.
    expect(status(c)).not.toContain("Regraded");
  });

  it("counts several refused weeks in the heading", async () => {
    const bad = (week_start: string) => ({
      week_start,
      found: true,
      adherence_error: "no",
      load_error: null,
    });
    const c = render({
      fetcher: respond(200, {
        ok: true,
        publish: { seconds: 1 },
        weeks: [bad("2026-10-12"), bad("2026-10-19")],
      }),
    });
    await press(c);
    expect(c.querySelector(".banner.stop b")!.textContent).toContain("refused 2 weeks");
  });

  it("a failed publish says so with its stderr, and does NOT refresh", async () => {
    const onDone = vi.fn();
    const c = render({
      onDone,
      fetcher: respond(500, {
        ok: false,
        stage: "publish",
        error: "publish.py exited 1",
        stderr: "Traceback",
      }),
    });
    await press(c);
    const banner = c.querySelector(".banner.stop")!;
    expect(banner.textContent).toContain("did not finish");
    expect(banner.textContent).toContain("publish.py exited 1");
    expect(c.querySelector("pre")!.textContent).toBe("Traceback");
    expect(onDone).not.toHaveBeenCalled();
    // It can be pressed again.
    expect(button(c).disabled).toBe(false);
  });

  it("banners sit ABOVE the control row, never inside it", async () => {
    const c = render({ fetcher: respond(500, { ok: false, error: "x" }) });
    await press(c);
    const kids = [...c.querySelector(".regrade-bar")!.children];
    expect(kids.map((k) => k.className)).toEqual(["banner stop", "edit-saverow"]);
  });
});
