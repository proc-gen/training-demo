import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Flag, Week } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { FlagsCard } from "./FlagsCard";

afterEach(cleanup);

const flag = (token: string, status: string): Flag => ({ token, status, why: "" });

const week = (over: Record<string, unknown>): Week => over as unknown as Week;

const tokens = (c: HTMLElement) =>
  [...c.querySelectorAll(".mono")].map((m) => m.textContent);

describe("FlagsCard", () => {
  it("says NO FLAGS EVALUATED when neither grader raised any", () => {
    // Which is a different statement from "nothing fired" -- a flag with no
    // data behind it means nobody looked.
    const { q } = wrap(<FlagsCard week={week({})} />);
    expect(q.getByText("No flags evaluated.")).toBeTruthy();
  });

  it("groups the two skills' flags under their own headings", () => {
    // A token means something different depending on which model raised it.
    const w = week({
      adherence: { flags: [flag("pace-creep", "clear")] },
      load: { flags: [flag("monotony", "fired")] },
    });
    const { container } = wrap(<FlagsCard week={w} />);
    const heads = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(heads).toEqual(["Adherence", "Load"]);
  });

  it("puts fired flags first", () => {
    // A flag that fired is the reason to read the card.
    const w = week({
      adherence: {
        flags: [flag("a", "clear"), flag("b", "fired"), flag("c", "not-evaluable")],
      },
    });
    const { container } = wrap(<FlagsCard week={w} />);
    expect(tokens(container)).toEqual(["b", "a", "c"]);
  });

  it("shows only the half that raised flags", () => {
    const w = week({
      adherence: { flags: [] },
      load: { flags: [flag("monotony", "fired")] },
    });
    const { container } = wrap(<FlagsCard week={w} />);
    expect([...container.querySelectorAll("h3")].map((h) => h.textContent)).toEqual([
      "Load",
    ]);
  });

  it("renders every flag, whatever its status", () => {
    const w = week({
      adherence: {
        flags: ["fired", "clear", "not-evaluable"].map((s, i) => flag(String(i), s)),
      },
    });
    const { container } = wrap(<FlagsCard week={w} />);
    expect(container.querySelectorAll(".flag")).toHaveLength(3);
  });

  it("is one card, however many blocks it holds", () => {
    const w = week({
      adherence: { flags: [flag("a", "fired")] },
      load: { flags: [flag("b", "fired")] },
    });
    const { container } = wrap(<FlagsCard week={w} />);
    expect(container.querySelectorAll("section.card")).toHaveLength(1);
  });
});
