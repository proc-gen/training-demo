import { describe, expect, it } from "vitest";

import {
  amountText,
  distanceText,
  hoursText,
  milesText,
  newRunKey,
  paceText,
  parseAmountInput,
  parseDistanceInput,
  parseHoursInput,
  parseMilesInput,
  parsePaceInput,
  parseRunMilesInput,
  parseSecondsInput,
  runMilesText,
  secondsText,
} from "./formModel";

describe("seconds display as clocks", () => {
  it("formats singles, ranges and absences", () => {
    expect(secondsText(1800)).toBe("30:00");
    expect(secondsText(6300)).toBe("105:00"); // minutes run past 59
    expect(secondsText([3600, 4200])).toBe("60:00-70:00");
    expect(secondsText(undefined)).toBe("");
    expect(secondsText("junk")).toBe("");
  });

  it("parses clocks, bare seconds and ranges", () => {
    expect(parseSecondsInput("30:00")).toBe(1800);
    expect(parseSecondsInput("1800")).toBe(1800);
    expect(parseSecondsInput("60:00-70:00")).toEqual([3600, 4200]);
    expect(parseSecondsInput("3600-4200")).toEqual([3600, 4200]);
  });

  it("round-trips every stored shape", () => {
    for (const v of [6, 720, 1800, 6300]) {
      expect(parseSecondsInput(secondsText(v))).toBe(v);
    }
    expect(parseSecondsInput(secondsText([3600, 4200]))).toEqual([3600, 4200]);
  });

  it("distinguishes cleared (undefined) from half-typed (null)", () => {
    expect(parseSecondsInput("")).toBeUndefined();
    expect(parseSecondsInput("  ")).toBeUndefined();
    expect(parseSecondsInput("30:")).toBeNull();
    expect(parseSecondsInput("30:99")).toBeNull();
    expect(parseSecondsInput("70:00-60:00")).toBeNull(); // inverted range
    expect(parseSecondsInput("0")).toBeNull();
    expect(parseSecondsInput("1-2-3")).toBeNull();
  });
});

describe("the week's time budget is hh:mm", () => {
  it("formats hours and minutes, not runaway minutes", () => {
    expect(hoursText(27000)).toBe("7:30"); // secondsText says 450:00
    expect(hoursText(28800)).toBe("8:00");
    expect(hoursText(14460)).toBe("4:01");
    expect(hoursText(undefined)).toBe("");
    expect(hoursText("junk")).toBe("");
  });

  it("parses h:mm and nothing else", () => {
    expect(parseHoursInput("7:30")).toBe(27000);
    expect(parseHoursInput(" 8:00 ")).toBe(28800);
    expect(parseHoursInput("12:05")).toBe(43500);
  });

  it("refuses what the mm:ss parser would have accepted", () => {
    // A bare integer is seconds to `parseSecondsInput` and ambiguous here.
    expect(parseSecondsInput("450")).toBe(450);
    expect(parseHoursInput("450")).toBeNull();
    expect(parseHoursInput("7")).toBeNull();
    expect(parseHoursInput("7:60")).toBeNull();
    expect(parseHoursInput("7:5")).toBeNull();
    expect(parseHoursInput("0:00")).toBeNull();
    expect(parseHoursInput("-1:00")).toBeNull();
  });

  it("distinguishes cleared (undefined) from half-typed (null)", () => {
    expect(parseHoursInput("")).toBeUndefined();
    expect(parseHoursInput("   ")).toBeUndefined();
    expect(parseHoursInput("7:")).toBeNull();
  });

  it("round-trips every committed budget, which are all whole minutes", () => {
    for (const v of [14460, 15840, 18000, 19500, 20460, 21600, 27000, 32400]) {
      expect(parseHoursInput(hoursText(v))).toBe(v);
    }
  });
});

describe("the week's mileage budget", () => {
  it("formats and parses a whole number", () => {
    expect(milesText(46)).toBe("46");
    expect(milesText(undefined)).toBe("");
    expect(parseMilesInput("46")).toBe(46);
    expect(parseMilesInput(" 46 ")).toBe(46);
    expect(parseMilesInput(milesText(52))).toBe(52);
  });

  it("refuses a decimal, a zero and junk without reading them as cleared", () => {
    expect(parseMilesInput("46.5")).toBeNull();
    expect(parseMilesInput("0")).toBeNull();
    expect(parseMilesInput("-4")).toBeNull();
    expect(parseMilesInput("forty")).toBeNull();
    expect(parseMilesInput("")).toBeUndefined();
  });
});

describe("a run's own mileage goal", () => {
  it("formats singles, ranges and absences", () => {
    expect(runMilesText(5)).toBe("5");
    expect(runMilesText(3.5)).toBe("3.5");
    expect(runMilesText([5, 6])).toBe("5-6");
    expect(runMilesText([4.5, 5.5])).toBe("4.5-5.5");
    expect(runMilesText(undefined)).toBe("");
    expect(runMilesText("junk")).toBe("");
    expect(runMilesText(0)).toBe("");
  });

  it("parses singles and ranges, and round-trips every stored shape", () => {
    expect(parseRunMilesInput("5")).toBe(5);
    expect(parseRunMilesInput(" 3.5 ")).toBe(3.5);
    expect(parseRunMilesInput("5-6")).toEqual([5, 6]);
    expect(parseRunMilesInput("4.5 - 5.5")).toEqual([4.5, 5.5]);
    for (const v of [1, 3.5, 5, 20.25]) {
      expect(parseRunMilesInput(runMilesText(v))).toBe(v);
    }
    expect(parseRunMilesInput(runMilesText([5, 6]))).toEqual([5, 6]);
  });

  it("TAKES A DECIMAL where the WEEK's whole-mile budget refuses one", () => {
    // The two are different quantities: a 3.5 mi recovery run is an ordinary
    // prescription, a fractional weekly budget is a precision nobody has.
    expect(parseRunMilesInput("3.5")).toBe(3.5);
    expect(parseMilesInput("3.5")).toBeNull();
  });

  it("distinguishes cleared (undefined) from half-typed (null)", () => {
    expect(parseRunMilesInput("")).toBeUndefined();
    expect(parseRunMilesInput("   ")).toBeUndefined();
    expect(parseRunMilesInput("five")).toBeNull();
    expect(parseRunMilesInput("0")).toBeNull();
    expect(parseRunMilesInput("5.")).toBeNull();
    expect(parseRunMilesInput("6-5")).toBeNull(); // inverted range
    expect(parseRunMilesInput("5-")).toBeNull();
    expect(parseRunMilesInput("1-2-3")).toBeNull();
  });

  it("permits an EQUAL-ENDED range, which the seconds pair also does", () => {
    expect(parseRunMilesInput("5-5")).toEqual([5, 5]);
  });
});

describe("distances", () => {
  it("formats singles and the mixed-length list", () => {
    expect(distanceText(200)).toBe("200");
    expect(distanceText([200, 200, 400])).toBe("200, 200, 400");
    expect(distanceText(undefined)).toBe("");
  });

  it("parses both, and round-trips them", () => {
    expect(parseDistanceInput("200")).toBe(200);
    expect(parseDistanceInput("200, 200, 400")).toEqual([200, 200, 400]);
    expect(parseDistanceInput(distanceText([200, 400]))).toEqual([200, 400]);
  });

  it("refuses junk without treating it as cleared", () => {
    expect(parseDistanceInput("")).toBeUndefined();
    expect(parseDistanceInput("two hundred")).toBeNull();
    expect(parseDistanceInput("200, x")).toBeNull();
    expect(parseDistanceInput("-200")).toBeNull();
  });
});

describe("a rep's own amount", () => {
  it("takes a decimal, unlike the week's whole-mile budget", () => {
    /* `4.5 mi` and `1.5 km` are ordinary rep prescriptions; a weekly budget of
     * `46.3` is a precision the plan does not have. Two parsers on purpose. */
    expect(parseAmountInput("4.5")).toBe(4.5);
    expect(parseMilesInput("4.5")).toBeNull();
    expect(amountText(6437.376)).toBe("6437.376");
    expect(amountText(undefined)).toBe("");
  });

  it("refuses junk without treating it as cleared", () => {
    expect(parseAmountInput("")).toBeUndefined();
    expect(parseAmountInput("0")).toBeNull();
    expect(parseAmountInput("-4")).toBeNull();
    expect(parseAmountInput("four")).toBeNull();
  });
});

describe("a target pace is a clock", () => {
  it("formats singles and ranges", () => {
    expect(paceText(360)).toBe("6:00");
    expect(paceText([366, 373])).toBe("6:06-6:13");
    expect(paceText(undefined)).toBe("");
  });

  it("parses both and round-trips them", () => {
    expect(parsePaceInput("6:00")).toBe(360);
    expect(parsePaceInput("6:06-6:13")).toEqual([366, 373]);
    expect(parsePaceInput(paceText([366, 373]))).toEqual([366, 373]);
  });

  it("refuses a bare integer, which is genuinely ambiguous", () => {
    /* `parseHoursInput`'s rule: `6` in a pace field could be six seconds or
     * six minutes, and a form that guesses authors a target nobody typed. */
    expect(parsePaceInput("6")).toBeNull();
    expect(parsePaceInput("360")).toBeNull();
    expect(parsePaceInput("")).toBeUndefined();
    expect(parsePaceInput("6:60")).toBeNull();
    expect(parsePaceInput("6:13-6:06")).toBeNull();
  });
});

describe("newRunKey", () => {
  it("uses the date, then counts -- and never collides", () => {
    const taken = new Set<string>();
    expect(newRunKey("2026-09-08", taken)).toBe("2026-09-08");
    taken.add("2026-09-08");
    expect(newRunKey("2026-09-08", taken)).toBe("2026-09-08-2");
    taken.add("2026-09-08-2");
    expect(newRunKey("2026-09-08", taken)).toBe("2026-09-08-3");
  });
});
