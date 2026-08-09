/* The calendar grid. Pure date arithmetic, and the only place in the app that
 * does any -- which is why it is tested this heavily for a component nobody
 * would call complicated.
 */

/** An ISO date from a Date, in LOCAL time.
 *
 * Not `toISOString()`, which converts to UTC and lands on the previous day for
 * anyone west of Greenwich -- the same trap `dayName` avoids by parsing at noon.
 */
export function isoDate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** Monday-based calendar rows covering every date present, gaps included.
 *
 * Monday-based to match the week manifests, which open on Monday. Each row is
 * seven slots; a slot with no data is `null` and renders as an empty cell
 * rather than being skipped, so the columns stay aligned to weekdays.
 */
export function calendarRows(dates: string[]): { start: string; days: (string | null)[] }[] {
  if (!dates.length) return [];
  const present = new Set(dates);
  const all = [...dates].sort();

  const first = new Date(all[0] + "T12:00:00");
  // (getDay() + 6) % 7 maps Sunday=0 onto 6, making Monday the zero.
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(all[all.length - 1] + "T12:00:00");

  const rows: { start: string; days: (string | null)[] }[] = [];
  const cur = new Date(first);
  while (cur <= last) {
    const start = isoDate(cur);
    const days: (string | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      const key = isoDate(cur);
      days.push(present.has(key) ? key : null);
      cur.setDate(cur.getDate() + 1);
    }
    rows.push({ start, days });
  }
  return rows;
}
