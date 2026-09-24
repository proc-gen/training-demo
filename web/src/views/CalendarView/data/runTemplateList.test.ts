import { describe, expect, it } from "vitest";

import type { RunTemplate } from "@/lib/manifest/runTemplates";
import { ROLES } from "@/lib/manifest/vocab";
import {
  templateDetail,
  templateGroups,
  templateLabel,
} from "./runTemplateList";

const t = (id: string, run: Record<string, unknown>): RunTemplate => ({
  id,
  run,
});

describe("templateLabel", () => {
  it("is the athlete's own prescription where they wrote one", () => {
    expect(
      templateLabel(
        t("subt-1", { role: "subt", prescribed: "PM: 12x600m w/ 200m jog" }),
      ),
    ).toBe("PM: 12x600m w/ 200m jog");
  });

  it("composes one where nobody did, rather than rendering a blank row", () => {
    const label = templateLabel(
      t("easy-1", { role: "easy", prescribed_seconds: [3600, 4200] }),
    );
    expect(label).toBe("Easy · 60:00-70:00");
  });

  it("falls back to the id where even that composes to nothing", () => {
    /* A row with no label at all is indistinguishable from a broken list. */
    expect(templateLabel(t("run-1", {}))).toBe("run-1");
  });

  it("describes a workout by its shape", () => {
    expect(
      templateLabel(t("subt-1", { role: "subt", reps: 12, rep_distance_m: 600 })),
    ).toBe("Sub-T · 12 reps");
  });
});

describe("templateGroups", () => {
  it("groups by the role the template's own run states", () => {
    const got = templateGroups([
      t("easy-1", { role: "easy", prescribed: "60-70 min easy" }),
      t("subt-1", { role: "subt", prescribed: "12x600m" }),
      t("easy-2", { role: "easy", prescribed: "50 min easy" }),
    ]);
    expect(got.map((g) => g.role)).toEqual(["easy", "subt"]);
    expect(got[0].items.map((i) => i.label)).toEqual([
      "60-70 min easy",
      "50 min easy",
    ]);
  });

  it("orders roles as ROLES does, never alphabetically", () => {
    /* `recovery` precedes `easy` in the graders' own list, and alphabetising
     * would also put `cross` above it -- the mistake the role dropdown
     * declines to make. */
    const got = templateGroups([
      t("subt-1", { role: "subt" }),
      t("easy-1", { role: "easy" }),
      t("recovery-1", { role: "recovery" }),
    ]);
    expect(got.map((g) => g.role)).toEqual(["recovery", "easy", "subt"]);
    const order = got.map((g) => ROLES.indexOf(g.role as (typeof ROLES)[number]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("APPENDS a role the vocabulary does not name, never dropping it", () => {
    /* The `FLAG_COMPONENT` rule: an entry nobody can see reads as one that was
     * never saved. A hand-edited file is the way this happens. */
    const got = templateGroups([
      t("x-1", { role: "fartlek" }),
      t("easy-1", { role: "easy" }),
    ]);
    expect(got.map((g) => g.role)).toEqual(["easy", "fartlek"]);
  });

  it("gives a template stating no role a group of its own", () => {
    const got = templateGroups([t("run-1", { prescribed: "something" })]);
    expect(got).toHaveLength(1);
    expect(got[0].items[0].id).toBe("run-1");
  });

  it("has no groups at all for no templates", () => {
    expect(templateGroups([])).toEqual([]);
  });
});

describe("templateDetail", () => {
  const rows = (template: RunTemplate) =>
    Object.fromEntries(templateDetail(template).map((r) => [r.label, r.value]));

  it("always states the role and the duration, dashing what is unstated", () => {
    expect(rows(t("easy-1", { role: "easy" }))).toEqual({
      role: "Easy",
      duration: "—",
    });
  });

  it("states a duration as a clock, the repo-wide rule", () => {
    expect(rows(t("easy-1", { role: "easy", prescribed_seconds: 1800 })).duration)
      .toBe("30:00");
  });

  it("states a mileage goal only where the plan states one", () => {
    expect(rows(t("easy-1", { role: "easy" })).miles).toBeUndefined();
    expect(
      rows(t("easy-1", { role: "easy", prescribed_miles: [5, 6] })).miles,
    ).toBe("5-6 mi");
    expect(rows(t("long-1", { role: "long", prescribed_miles: 12 })).miles).toBe(
      "12 mi",
    );
  });

  it("says a long run is one", () => {
    expect(rows(t("long-1", { role: "long", is_long: true }))["long run"]).toBe(
      "yes",
    );
  });

  it("describes a workout set by set, in the words the fold uses", () => {
    const got = rows(
      t("subt-1", {
        role: "subt",
        reps: 12,
        rep_distance_m: 600,
        float_distance_m: 200,
        float_mode: "jog",
      }),
    );
    expect(got.structure).toBe("1 set, 12 reps");
    expect(got["set 1"]).toBe("12x600m w/ 200m jog");
  });

  it("gives a grouped workout one line per set", () => {
    const got = templateDetail(
      t("rep-1", {
        role: "repetition",
        reps: 6,
        groups: 2,
        rep_distance_m: 200,
        float_distance_m: 200,
        group_float_distance_m: 400,
      }),
    );
    const labels = got.map((r) => r.label);
    expect(labels).toContain("set 1");
    expect(labels).toContain("set 2");
    expect(got.find((r) => r.label === "structure")?.value).toBe(
      "2 sets, 6 reps",
    );
    /* THE TRAILING RECOVERY IS SAID, the last set included -- both graders
     * charge one after every set, so leaving it off would hide a jog. */
    expect(got.find((r) => r.label === "set 2")?.value).toContain("then 400m");
  });

  it("states no structure rows for a continuous run", () => {
    expect(
      templateDetail(t("easy-1", { role: "easy" })).map((r) => r.label),
    ).toEqual(["role", "duration"]);
  });
});
