/* `athletes/<slug>/other-training.json` -- lifting and PT, the athlete's own
 * free text, one entry per date: `{"days": {"YYYY-MM-DD": "text"}}`.
 *
 * ITS OWN FILE, NOT A MANIFEST KEY, AND THAT IS THE WHOLE REASON IT EXISTS.
 * It lived in the week manifest as `other_training` for five days, and a week
 * is PENDING wherever its manifest's bytes hash differently from
 * `published/graded-plans.json` -- so writing down a PT routine asked for a
 * regrade of a week whose grade it could not move. The athlete: *"it requires
 * regrading the week even though it's not used for any calculations."* Out
 * here, no grader reads it and no hash covers it.
 *
 * KEYED UNDER `days` so the record has ONE member rather than one per date --
 * the shape `docs/data-model.md` can draw, the `graded-plans.json` rule.
 *
 * NEVER FOLD IT INTO `notes`. That map is scanned by `unilateral-complaint`,
 * and "left knee PT" would fire the flag.
 *
 * PURE. The read and the write are `manifestIo.ts`'s.
 */

export type OtherTrainingDays = Record<string, string>;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The `days` map of a parsed file, keeping string entries only. Anything that
 *  is not that shape reads as empty: the text is display-only, and a cell
 *  without its icon is the honest rendering of a file nobody can read. */
export function otherTrainingDays(record: unknown): OtherTrainingDays {
  if (!isObj(record) || !isObj(record.days)) return {};
  const out: OtherTrainingDays = {};
  for (const [date, text] of Object.entries(record.days)) {
    if (typeof text === "string" && text !== "") out[date] = text;
  }
  return out;
}

/** One date's text, or `""` -- the cleared state `DayMeta` already uses. */
export function otherTrainingOf(record: unknown, date: string): string {
  return otherTrainingDays(record)[date] ?? "";
}

/** The whole file with one date set, or deleted on `""`.
 *
 * EVERYTHING ELSE IN THE FILE SURVIVES -- a `_comment`, a key a later version
 * adds -- the posture `merge.ts` takes towards a manifest. `days` is rebuilt
 * in DATE ORDER so the file diffs one line per edit rather than reshuffling.
 * An emptied map stays `{}`: the file is the athlete's, and deleting it would
 * be the editor deciding what exists. */
export function withOtherTraining(
  record: unknown,
  date: string,
  text: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(record) ? { ...record } : {};
  const days = isObj(out.days) ? { ...out.days } : {};
  if (text) days[date] = text;
  else delete days[date];
  const sorted: Record<string, unknown> = {};
  for (const d of Object.keys(days).sort()) sorted[d] = days[d];
  out.days = sorted;
  return out;
}

/** The entries whose date is in `dates`, for a calendar window or one week. */
export function otherTrainingIn(
  days: OtherTrainingDays,
  dates: Iterable<string>,
): OtherTrainingDays {
  const out: OtherTrainingDays = {};
  for (const d of dates) if (days[d]) out[d] = days[d];
  return out;
}
