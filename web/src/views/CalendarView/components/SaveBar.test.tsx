import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { SaveBar } from "./SaveBar";

afterEach(cleanup);

describe("SaveBar", () => {
  it("saves on click and says GRADING while it waits -- that is what the wait is", () => {
    const onSave = vi.fn();
    const idle = wrap(<SaveBar saving={false} outcome={null} onSave={onSave} />);
    const button = idle.container.querySelector("button")!;
    expect(button.textContent).toBe("Save");
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
    cleanup();

    const busy = wrap(<SaveBar saving outcome={null} onSave={onSave} />);
    const b = busy.container.querySelector("button")!;
    expect(b.disabled).toBe(true);
    // THE LABEL DOES NOT MOVE. It carried "Saving -- grading the week..."
    // until 2026-09-03, which resized the control mid-save; the status is its
    // own element beside it now, so there is one place for "what is
    // happening" and one fixed-width control.
    expect(b.textContent).toBe("Save");
    expect(busy.container.querySelector(".edit-saverow p")!.textContent)
      .toContain("Grading");
  });

  it("the button is a BUTTON, and the row that holds it is the last thing", () => {
    /* It shipped as a bare <button>, which Tailwind's preflight strips to
     * plain text -- the athlete could not tell it was clickable. The class is
     * what carries the fill, so its absence is the defect and is asserted;
     * jsdom applies no CSS, so this is as far as a test can reach and the
     * colours still have to be looked at in a browser. */
    const { container } = wrap(
      <SaveBar saving={false} outcome={null} onSave={() => {}} />,
    );
    expect(container.querySelector("button")!.className).toBe("save");
    expect(container.querySelector(".edit-savebar > :last-child")!.className)
      .toBe("edit-saverow");
  });

  it("a banner sits ABOVE the control row, never inside it", () => {
    /* Right-aligning a paragraph and a <ul> of grader issues is unreadable,
     * and the reason for a failure belongs above the button you are about to
     * press again. */
    const { container } = wrap(
      <SaveBar
        saving={false}
        outcome={{ ok: false, message: "refused", issues: ["role: bad"] }}
        onSave={() => {}}
      />,
    );
    const kids = [...container.querySelector(".edit-savebar")!.children];
    expect(kids.map((k) => k.className)).toEqual(["banner stop", "edit-saverow"]);
    expect(container.querySelector(".edit-saverow .banner")).toBeNull();
  });

  it("renders a refusal with its issues and stderr tail", () => {
    const { container } = wrap(
      <SaveBar
        saving={false}
        outcome={{
          ok: false,
          message: "publish.py exited 1",
          issues: ["role: bad token"],
          stderr: "Traceback ...",
        }}
        onSave={() => {}}
      />,
    );
    const banner = container.querySelector(".banner.stop")!;
    expect(banner.textContent).toContain("publish.py exited 1");
    expect(banner.textContent).toContain("role: bad token");
    expect(container.querySelector("pre")!.textContent).toContain("Traceback");
  });

  it("a save the GRADER refused says the manifest is written and shows why", () => {
    const { container } = wrap(
      <SaveBar
        saving={false}
        outcome={{
          ok: true,
          seconds: 13.6,
          grader: {
            found: true,
            adherence_error: "grade_week.py exited 1: unknown role",
            load_error: null,
          },
        }}
        onSave={() => {}}
      />,
    );
    const banner = container.querySelector(".banner.stop")!;
    expect(banner.textContent).toContain("manifest is written");
    expect(banner.textContent).toContain("unknown role");
  });

  it("a clean save is one quiet sentence with the duration", () => {
    const { container } = wrap(
      <SaveBar
        saving={false}
        outcome={{
          ok: true,
          seconds: 13.6,
          grader: { found: true, adherence_error: null, load_error: null },
        }}
        onSave={() => {}}
      />,
    );
    expect(container.querySelector(".banner.stop")).toBeNull();
    // Beside the button, which is where the athlete asked for it.
    expect(container.querySelector(".edit-saverow p.muted")!.textContent)
      .toContain("13.6");
  });

  it("says nothing beside the button when a banner already said it", () => {
    /* The same fact twice at two widths. A failure has its banner; the row
     * carries the clean-save sentence and the busy one and nothing else. */
    const { container } = wrap(
      <SaveBar
        saving={false}
        outcome={{ ok: false, message: "refused" }}
        onSave={() => {}}
      />,
    );
    expect(container.querySelector(".edit-saverow p")).toBeNull();
  });
});
