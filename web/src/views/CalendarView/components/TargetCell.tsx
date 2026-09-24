"use client";

import { labelOf, REP_BAND_LABELS } from "@/lib/manifest/labels";
import { REP_BANDS } from "@/lib/manifest/vocab";
import { RACE_DISTANCES } from "@/lib/pacemodels/constants";
import {
  paceText,
  parsePaceInput,
  parseSecondsInput,
  secondsText,
} from "../data/formModel";
import {
  defaultTargetFor,
  type Target,
  type TargetKind,
} from "../data/structure";

/** The race paces a target may name.
 *
 * FROM `RACE_DISTANCES`, which is already a pinned port of
 * `scripts/pace-models/model.json`, so this list cannot drift from the chart
 * schema's own `race_paces` keys. `tempo` is deliberately NOT offered: it is
 * the Daniels 60-80 minute RANGE and carries `fast_sec_per_mi`/`slow_sec_per_mi`
 * rather than the `sec_per_mi` `race_pace_sec_per_mi` reads, so naming it would
 * author a target that resolves to nothing and silently scores no reps.
 */
const RACE_NAMES = Object.keys(RACE_DISTANCES);

const KIND_LABEL: Record<TargetKind, string> = {
  none: "—",
  band: "band",
  zone: "zone",
  race: "race pace",
  time: "rep time",
  pace: "pace",
};

const KIND_HELP: Record<TargetKind, string> = {
  none: "No target — the rep is reported and scored by nothing",
  band: "A sub-T band from the week's chart, graded on heart rate",
  zone: "Anywhere between two race paces — 800m–3000m is repetition pace, and any other pair says its own zone",
  race: "One race pace from the week's chart, which collapses the zone to a point",
  time: "A rep TIME, used verbatim — run 200m in 27.5s",
  pace: "A pace you type, for an effort the chart has no name for",
};

/** What one rep is aimed at: a kind, then its value.
 *
 * SIX KINDS OVER FIVE MANIFEST KEYS, and the pairing is in `structure.ts`
 * because it is the half that has to be reversible. What lives here is the
 * choosing.
 *
 * **THE ZONE IS TWO NAMED PACES AND NO LONGER A CONSTANT** (2026-09-05). It was
 * locked to the model's 800m-3000m repetition range, so `5k-10k pace` could not
 * be said at all -- the athlete's fourth bug. Its two ends are chosen here, and
 * a repetition zone left untouched still writes NOTHING, because a set that
 * states no `target_pace` already IS the model default.
 *
 * A VALUE THE LIST DOES NOT KNOW IS APPENDED, never dropped -- the
 * `unmappedFlags` rule. Three committed charts carry a race distance outside
 * `RACE_DISTANCES`, and a select that silently showed blank would rewrite the
 * athlete's own target on the next save.
 */
export function TargetCell({
  target,
  what,
  onChange,
}: {
  target: Target;
  /** Which rep this target belongs to, for the tooltips. */
  what: string;
  onChange: (next: Target) => void;
}) {
  const withUnknown = (list: string[], value: string) =>
    list.includes(value) ? list : [...list, value];

  return (
    <span className="wk-target">
      <select
        aria-label={`${what} target`}
        title={`What ${what} is aimed at`}
        value={target.kind}
        onChange={(e) =>
          onChange(defaultTargetFor(e.target.value as TargetKind, target))
        }
      >
        {(Object.keys(KIND_LABEL) as TargetKind[]).map((k) => (
          <option key={k} value={k} title={KIND_HELP[k]}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>

      {target.kind === "band" ? (
        <select
          className="wk-band"
          aria-label={`${what} band`}
          title={`Which sub-T band ${what} is held to`}
          value={target.band}
          onChange={(e) => onChange({ ...target, band: e.target.value })}
        >
          {withUnknown([...REP_BANDS], target.band).map((b) => (
            <option key={b} value={b}>
              {labelOf(REP_BAND_LABELS, b)}
            </option>
          ))}
        </select>
      ) : null}

      {target.kind === "race" ? (
        <select
          className="wk-race"
          aria-label={`${what} race pace`}
          title={`Which race pace ${what} is run at`}
          value={target.race}
          onChange={(e) => onChange({ ...target, race: e.target.value })}
        >
          {withUnknown(RACE_NAMES, target.race).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ) : null}

      {target.kind === "zone" ? (
        <>
          <select
            className="wk-race"
            aria-label={`${what} zone fast end`}
            title={`The FAST end of the zone ${what} is run in`}
            value={target.fast}
            onChange={(e) =>
              onChange({ ...target, fast: e.target.value })
            }
          >
            {withUnknown(RACE_NAMES, target.fast).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="wk-label">–</span>
          <select
            className="wk-race"
            aria-label={`${what} zone slow end`}
            title={`The SLOW end of the zone ${what} is run in`}
            value={target.slow}
            onChange={(e) =>
              onChange({ ...target, slow: e.target.value })
            }
          >
            {withUnknown(RACE_NAMES, target.slow).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {target.kind === "time" ? (
        <input
          type="text"
          className="wk-num"
          placeholder="mm:ss"
          aria-label={`${what} target time`}
          title={`The time ${what} is run in, used verbatim`}
          /* KEYED ON ITS OWN SEED, `LengthCell`'s rule: the rows above are
             keyed by index, so a removed set or rep hands this box another
             target, and an uncontrolled box shows a new `defaultValue` only
             by remounting. */
          key={secondsText(target.seconds)}
          defaultValue={secondsText(target.seconds)}
          onBlur={(e) => {
            const v = parseSecondsInput(e.target.value);
            if (v === null) return;
            onChange({ ...target, seconds: v === undefined ? 0 : v });
          }}
        />
      ) : null}

      {target.kind === "pace" ? (
        <input
          type="text"
          className="wk-num"
          placeholder="m:ss/mi"
          aria-label={`${what} target pace`}
          title={`The pace ${what} is run at, per mile — a range is allowed`}
          key={paceText(target.secPerMi)}
          defaultValue={paceText(target.secPerMi)}
          onBlur={(e) => {
            const v = parsePaceInput(e.target.value);
            if (v === null) return;
            onChange({ ...target, secPerMi: v === undefined ? 0 : v });
          }}
        />
      ) : null}
    </span>
  );
}
