import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Load } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { FitnessTable } from "./FitnessTable";

afterEach(cleanup);

const fitness = (over: Record<string, unknown> = {}) => ({
  trimp: 639.9,
  ctl: 81.57,
  atl: 94.02,
  tsb: -12.45,
  acwr_run: 1.15,
  ctl_converged: true,
  atl_converged: true,
  history_days: 182,
  ctl_warmup_days: 126,
  seed_date: "2026-02-09",
  earliest_activity: "2026-02-09",
  on_date: "2026-08-09",
  days_covered: 7,
  ctl_max_in_series: 81.57,
  series_span_days: 182,
  trimp_source: "stream",
  stream_share: 1,
  activities: 11,
  unpriced: 0,
  ...over,
});

const load = (over: Record<string, unknown> = {}): Load =>
  ({ fitness: fitness(over) }) as unknown as Load;

const rowFor = (c: HTMLElement, k: string) =>
  [...c.querySelectorAll("tbody tr")].find((r) =>
    r.querySelector("td")?.textContent?.includes(k),
  )!;

describe("FitnessTable", () => {
  it("shows the four figures", () => {
    const { container } = wrap(<FitnessTable load={load()} />);
    expect(rowFor(container, "TRIMP").textContent).toContain("640");
    expect(rowFor(container, "Fitness (CTL)").textContent).toContain("82");
    expect(rowFor(container, "Fatigue (ATL)").textContent).toContain("94");
    expect(rowFor(container, "Form (TSB)").textContent).toContain("-12");
  });

  it("says the week was MEASURED when every activity had a stream", () => {
    // The tier label is the only thing separating a measurement from a ~3%
    // understatement, so it has to be on the page rather than in a caveat.
    const { container } = wrap(<FitnessTable load={load()} />);
    expect(rowFor(container, "TRIMP").textContent).toContain("measured");
    expect(rowFor(container, "TRIMP").textContent).toContain("11 activit");
  });

  it("names the estimated share when part of the week was priced from average HR", () => {
    const { container } = wrap(
      <FitnessTable load={load({ stream_share: 0.79, trimp_source: "mixed" })} />,
    );
    expect(rowFor(container, "TRIMP").textContent).toContain("79% measured");
    expect(rowFor(container, "TRIMP").textContent).toContain("estimated");
  });

  it("WITHHOLDS fitness and form before the 42-day average converges", () => {
    const { container } = wrap(
      <FitnessTable
        load={load({
          ctl_converged: false,
          ctl: null,
          tsb: null,
          history_days: 100,
        })}
      />,
    );
    expect(rowFor(container, "Fitness (CTL)").textContent).toContain("--");
    expect(rowFor(container, "Form (TSB)").textContent).toContain("--");
  });

  it("says HOW SHORT it is, because a bare dash is unreadable", () => {
    // A reader who sees `--` with no reason cannot tell a missing measurement
    // from a warm-up that is still running.
    const { container } = wrap(
      <FitnessTable
        load={load({ ctl_converged: false, ctl: null, history_days: 100 })}
      />,
    );
    expect(rowFor(container, "Fitness (CTL)").textContent).toContain("26 more day");
  });

  it("still publishes FATIGUE on an unconverged week", () => {
    // The asymmetry is measured, not cautious: a 7-day average converges in
    // three weeks while a 42-day one does not.
    const { container } = wrap(
      <FitnessTable load={load({ ctl_converged: false, ctl: null, tsb: null })} />,
    );
    expect(rowFor(container, "Fatigue (ATL)").textContent).toContain("94");
  });

  it("still publishes TRIMP on an unconverged week", () => {
    const { container } = wrap(
      <FitnessTable load={load({ ctl_converged: false, ctl: null })} />,
    );
    expect(rowFor(container, "TRIMP").textContent).toContain("640");
  });

  it("labels the fitness maximum with the span it covers, not as all-time", () => {
    // A maximum over six months is a different quantity from an all-time one.
    const { container } = wrap(<FitnessTable load={load()} />);
    expect(rowFor(container, "Fitness (CTL)").textContent).toContain("182 days");
  });

  it("says so plainly when there is no series", () => {
    const { container } = wrap(<FitnessTable load={{} as Load} />);
    expect(container.textContent).toContain("No TRIMP series");
  });

  it("dashes a figure that is null without claiming it is zero", () => {
    const { container } = wrap(<FitnessTable load={load({ atl: null })} />);
    expect(rowFor(container, "Fatigue (ATL)").textContent).toContain("--");
    expect(rowFor(container, "Fatigue (ATL)").textContent).not.toContain("0");
  });
});
