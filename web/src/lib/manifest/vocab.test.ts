import { describe, expect, it } from "vitest";

import VOCAB from "@/test/manifestVocab.json";
import {
  DEVIATION_REASONS,
  FLOAT_MODES,
  REP_BANDS,
  REPETITION_ZONE,
  ROLES,
  SET_MODES,
  WEEK_TYPES,
} from "./vocab";

/* One half of the two-language pin -- the constants must be the committed
 * fixture, ORDER INCLUDED, because a select control's order is meaningful.
 * The other half is TestTheManifestVocabPinIsFresh in tests/test_data_model.py,
 * which holds the fixture to the Python owners. Skip either and the pair says
 * nothing. */
describe("the vocabularies are the fixture's", () => {
  it("roles", () => expect([...ROLES]).toEqual(VOCAB.roles));
  it("set modes", () => expect([...SET_MODES]).toEqual(VOCAB.set_modes));
  it("week types", () => expect([...WEEK_TYPES]).toEqual(VOCAB.week_types));
  it("rep bands", () => expect([...REP_BANDS]).toEqual(VOCAB.rep_bands));
  it("deviation reasons", () =>
    expect([...DEVIATION_REASONS]).toEqual(VOCAB.deviation_reasons));
  it("float modes", () => expect([...FLOAT_MODES]).toEqual(VOCAB.float_modes));

  /* NOT A TOKEN LIST, and pinned for exactly the same reason. The two ends of
   * the repetition zone are the adherence model's `repetition_date_pace`, and
   * the editor needs `default_target` to state the `rep_pace` that PRICES a
   * repetition rep -- so a literal `"3000m"` here would be a model number
   * living in a browser, uncalibrated on anybody. */
  it("the repetition zone's two ends", () =>
    expect({ ...REPETITION_ZONE }).toEqual(VOCAB.repetition_zone));

  it("is not vacuous -- the fixture actually carries tokens", () => {
    expect(VOCAB.roles.length).toBeGreaterThan(10);
    expect(VOCAB.week_types.length).toBe(4);
    expect(VOCAB.repetition_zone.fast_target).toBeTruthy();
  });
});
