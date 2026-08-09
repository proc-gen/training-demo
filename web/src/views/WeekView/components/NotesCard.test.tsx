import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { NotesCard } from "./NotesCard";

afterEach(cleanup);

const week = (notes: { adherence?: string | null; load?: string | null }): Week =>
  ({ week_start: "2026-07-27", notes }) as unknown as Week;

const summaries = (c: HTMLElement) =>
  [...c.querySelectorAll("summary")].map((s) => s.textContent);

describe("NotesCard", () => {
  it("renders NOTHING when there is no commentary", () => {
    // Not an empty card: a week nobody wrote about has no commentary section.
    const { container } = wrap(<NotesCard week={week({})} />);
    expect(container.textContent).toBe("");
  });

  it("shows both notes when both exist", () => {
    const { container } = wrap(
      <NotesCard week={week({ adherence: "<p>a</p>", load: "<p>l</p>" })} />,
    );
    expect(container.querySelectorAll("details")).toHaveLength(2);
  });

  it("names each note's source file", () => {
    const { container } = wrap(
      <NotesCard week={week({ adherence: "<p>a</p>", load: "<p>l</p>" })} />,
    );
    expect(summaries(container)[0]).toContain("notes/week-2026-07-27.md");
    expect(summaries(container)[1]).toContain("notes/load/week-2026-07-27.md");
  });

  it("shows only the half that has a note", () => {
    const { container } = wrap(<NotesCard week={week({ load: "<p>l</p>" })} />);
    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(summaries(container)[0]).toContain("notes/load/");
  });

  it("says where the numbers stop and the narrative starts", () => {
    // Numbers come from the graders, prose comes from the notes, and neither is
    // transcribed twice.
    const { container } = wrap(<NotesCard week={week({ adherence: "<p>a</p>" })} />);
    expect(container.querySelector(".note")!.textContent).toContain("verbatim");
  });

  it("is a card titled Commentary", () => {
    const { container } = wrap(<NotesCard week={week({ adherence: "<p>a</p>" })} />);
    expect(container.querySelector("section.card > h2")!.textContent).toBe(
      "Commentary",
    );
  });
});
