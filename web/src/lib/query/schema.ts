/* The read model's schema. Pure strings -- no filesystem, no database handle.
 *
 * DOCUMENTS IN TABLES, SCALARS IN VIRTUAL COLUMNS, ROWS IN VIEWS. Every record
 * `published/` holds is stored as its own JSON text, byte for byte, and nothing
 * is ever shredded into a second copy:
 *
 *   - a VIRTUAL generated column computes on read and costs no storage, so
 *     `week.miles` is not a copy of `facts.miles`, it IS `facts.miles` reached
 *     by a shorter name. It can still be indexed and sorted on.
 *   - a VIEW over `json_each` gives the per-run and per-day rows the trend
 *     series need without materialising them. 729 runs scan in ~17 ms, which is
 *     paid on ONE route and against ~130 ms for the whole payload today.
 *
 * WHY IT MATTERS THAT THESE ARE NOT COPIES. This repo has paid twice for the
 * same measurement stored in two places -- `history.json`'s weekly series and
 * the hand-pasted `derived/adherence.csv`, both of which went stale while
 * reading as current. A derived index is allowed to exist because it is
 * rebuilt wholesale from the tracked bytes and never edited; it is NOT allowed
 * to hold a second spelling of a number that could drift from the first.
 *
 * `assemblePayload()` reads only the document columns, so the equality test
 * against `assembleFromRecords()` also transitively pins that the documents
 * arrived intact.
 *
 * ENGINE-AGNOSTIC, AND THAT IS LOAD-BEARING NOW. The same DDL is executed by
 * `node:sqlite` on the server and by sqlite-wasm in the browser for the static
 * export. Everything below is core SQLite plus JSON1, which both carry:
 * `without rowid` (3.8.2), VIRTUAL generated columns (3.31) and `json_each`.
 * Nothing here may grow an extension or a pragma only one of them has --
 * `lib/wasmdb/parity.test.ts` would catch it, but the rule is easier to keep
 * than the failure is to read.
 */

/** Bumped whenever the DDL below changes, which forces a rebuild.
 *
 * A schema change is not a data change, so the source stamp cannot see it: an
 * index built by yesterday's code against today's unchanged `published/` would
 * be reused with columns that no longer exist. This is the one invalidation the
 * mtime check cannot do on its own.
 */
export const SCHEMA_VERSION = 1;

/** The whole schema, executed in one `exec()` on a fresh database. */
export const SCHEMA_SQL = `
-- The index's own bookkeeping: schema version and the source stamp it was
-- built from. Read before anything else; a mismatch means rebuild.
create table meta (
  key   text primary key,
  value text not null
) without rowid;

-- One row per directory under published/weeks/. The columns are the FILES in
-- it, verbatim -- so a week is reassembled by parsing them, exactly as
-- readWeek() parses the same files.
create table week (
  week_start           text primary key,
  ordinal              integer not null,   -- index.json's own order
  week_json            text not null,
  adherence_json       text,               -- absent when the grader failed
  load_json            text,               -- absent when the grader failed
  trimp_json           text not null,      -- always written; [] is a real value
  notes_adherence_html text,
  notes_load_html      text,

  -- Reached by a shorter name, not copied. All VIRTUAL.
  pace_chart_week_ending text generated always as
    (json_extract(week_json, '$.pace_chart_week_ending')) virtual,
  week_end        text generated always as
    (json_extract(adherence_json, '$.week_end')) virtual,
  -- hasRuns() in lib/data/weeks.ts: at least one MEASURED run. A week authored
  -- two Mondays ahead has records that are not empty -- miles 0.0, quality
  -- share 0 -- and none of those is a measurement.
  has_runs        integer generated always as
    (coalesce(json_array_length(adherence_json, '$.results'), 0) > 0) virtual,
  miles           real generated always as
    (json_extract(adherence_json, '$.facts.miles')) virtual,
  elapsed_days    integer generated always as
    (json_extract(adherence_json, '$.facts.elapsed_days')) virtual,
  quality_share   real generated always as
    (json_extract(adherence_json, '$.facts.quality_share')) virtual,
  week_pct        real generated always as
    (json_extract(adherence_json, '$.scores.week.pct')) virtual,
  integrity_total real generated always as
    (json_extract(load_json, '$.integrity.total')) virtual,
  acwr_mech       real generated always as
    (json_extract(load_json, '$.acwr_mech')) virtual,
  load_day_count  integer generated always as
    (coalesce(json_array_length(load_json, '$.days'), 0)) virtual
) without rowid;

create index week_by_ordinal on week (ordinal);
create index week_lived      on week (has_runs, week_start);

-- One row per published/days/<date>.json. The steps-and-wellness join.
create table day (
  date    text primary key,
  ordinal integer not null,
  doc     text not null,

  resting_hr   real generated always as (json_extract(doc, '$.resting_hr')) virtual,
  sleep_hours  real generated always as (json_extract(doc, '$.sleep_hours')) virtual,
  hrv          real generated always as (json_extract(doc, '$.hrv')) virtual,
  total_steps  real generated always as (json_extract(doc, '$.total_steps')) virtual,
  run_steps    real generated always as (json_extract(doc, '$.run_steps')) virtual,
  nonrun_steps real generated always as (json_extract(doc, '$.nonrun_steps')) virtual,
  completeness text generated always as (json_extract(doc, '$.completeness')) virtual
) without rowid;

create index day_by_ordinal on day (ordinal);

-- THE CHART TABLE. 87 distinct charts across 102 weeks: resolve_snapshot()
-- carries a chart forward, so the join from week is genuinely N:1.
create table pace_chart (
  week_ending text primary key,
  doc         text not null
) without rowid;

-- The top-level records: athlete, banners, history, thresholds,
-- pace_models_current, and pace_chart_current's POINTER (a key, not a chart).
create table singleton (
  key text primary key,
  doc text not null
) without rowid;

-- Per-run rows, WITHOUT a second copy of any run. The trend series read five
-- scalars per run across every week; this is how they get them.
create view run as
  select
    w.week_start                              as week_start,
    r.key                                     as ordinal,
    json_extract(r.value, '$.date')           as date,
    json_extract(r.value, '$.role')           as role,
    json_extract(r.value, '$.pace')           as pace,
    json_extract(r.value, '$.miles')          as miles,
    json_extract(r.value, '$.distance_source') as distance_source,
    json_extract(r.value, '$.status')         as status,
    json_extract(r.value, '$.pct')            as pct,
    r.value                                   as doc
  from week w, json_each(w.adherence_json, '$.results') r
  where w.adherence_json is not null;

-- Per-day load rows, same treatment. fitnessSeries() reads six scalars per day
-- across every week and dedupes on date, because weeks overlap at a boundary.
create view load_day as
  select
    w.week_start                       as week_start,
    json_extract(d.value, '$.date')    as date,
    json_extract(d.value, '$.trimp')   as trimp,
    json_extract(d.value, '$.bg_trimp') as bg_trimp,
    json_extract(d.value, '$.ctl')     as ctl,
    json_extract(d.value, '$.atl')     as atl,
    json_extract(d.value, '$.tsb')     as tsb,
    d.value                            as doc
  from week w, json_each(w.load_json, '$.days') d
  where w.load_json is not null;
`;
