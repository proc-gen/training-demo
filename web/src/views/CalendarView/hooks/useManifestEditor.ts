import { useCallback, useState } from "react";

/* The editor's channel to `/api/manifest` -- a client component may not reach
 * `lib/db`, so fetch is how the FULL manifest (prose, `runalyze_id` and all)
 * reaches the browser in the private app. The demo never calls this: the edit
 * affordances are disabled there and the route itself is dropped from the
 * export.
 *
 * `fetcher` IS INJECTED, defaulting to the real `fetch` -- the IndexProvider
 * rule: a prop needs no module registry, so a test's fake cannot leak into
 * another file's render. Relative URLs are correct here because only the
 * private app -- served from the root -- ever fetches.
 */

export type GraderStatus = {
  found: boolean;
  adherence_error: unknown;
  load_error: unknown;
};

export type ManifestFetch =
  | {
      ok: true;
      manifest: Record<string, unknown>;
      /** The week's lifting/PT entries by date -- `other-training.json`, not
       *  the manifest. Absent from an older route's answer, so defaulted. */
      other_training: Record<string, string>;
    }
  | { ok: false; missing: boolean; message: string };

/** A save WRITES and stops. `pending` says whether the week now needs a
 *  Regrade -- false where only the lifting/PT text changed on a graded week,
 *  since that lives outside the manifest. Absent reads as pending. */
export type SaveOutcome =
  | { ok: true; pending?: boolean }
  | { ok: false; message: string; issues?: string[]; stderr?: string };

/** One week that WAS pending when the regrade ran, with the graders' verdicts
 *  read back from the fresh index. */
export type RegradedWeek = GraderStatus & { week_start: string };

export type RegradeOutcome =
  | { ok: true; seconds: number; weeks: RegradedWeek[] }
  | { ok: false; message: string; stderr?: string };

/** The weeks whose grader refused them -- what a Regrade has to SAY, because a
 *  refused manifest stays written and the page otherwise looks the same. */
export function refusedWeeks(
  outcome: RegradeOutcome | null,
): { week_start: string; errors: string[] }[] {
  if (!outcome?.ok) return [];
  return outcome.weeks
    .map((w) => ({
      week_start: w.week_start,
      errors: [w.adherence_error, w.load_error].filter(
        (e): e is string => typeof e === "string" && e.length > 0,
      ),
    }))
    .filter((w) => w.errors.length > 0);
}

export function useManifestEditor(fetcher: typeof fetch = fetch) {
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (weekStart: string): Promise<ManifestFetch> => {
      try {
        const res = await fetcher(`/api/manifest?start=${weekStart}`);
        const body = (await res.json()) as {
          manifest?: Record<string, unknown>;
          other_training?: Record<string, string>;
          error?: string;
        };
        if (res.ok && body.manifest) {
          return {
            ok: true,
            manifest: body.manifest,
            other_training: body.other_training ?? {},
          };
        }
        return {
          ok: false,
          /* 404 is the CREATE SIGNAL, not a failure -- the route says so. */
          missing: res.status === 404,
          message: body.error ?? `the manifest request failed (${res.status})`,
        };
      } catch (e) {
        return {
          ok: false,
          missing: false,
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
    [fetcher],
  );

  /** POST and parse, with `saving` held for the duration. A body that is not
   *  JSON -- a proxy's HTML error page -- becomes `{}` and the status speaks. */
  const post = useCallback(
    async (body: unknown) => {
      setSaving(true);
      try {
        const res = await fetcher("/api/manifest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const out = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          pending?: boolean;
          publish?: { seconds?: number };
          weeks?: RegradedWeek[];
          error?: string;
          issues?: string[];
          stderr?: string;
        };
        return { res, out };
      } finally {
        setSaving(false);
      }
    },
    [fetcher],
  );

  const save = useCallback(
    async (body: unknown): Promise<SaveOutcome> => {
      try {
        const { res, out } = await post(body);
        if (res.ok && out.ok) {
          return typeof out.pending === "boolean"
            ? { ok: true, pending: out.pending }
            : { ok: true };
        }
        return {
          ok: false,
          message:
            out.error ??
            (out.issues?.length
              ? "the save was refused"
              : `the save failed (${res.status})`),
          issues: out.issues,
          stderr: out.stderr,
        };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
    [post],
  );

  /** Publish once, for every pending week -- `scope: "publish"`. */
  const regrade = useCallback(
    async (athlete?: string): Promise<RegradeOutcome> => {
      try {
        const { res, out } = await post(
          athlete ? { scope: "publish", athlete } : { scope: "publish" },
        );
        if (res.ok && out.ok && Array.isArray(out.weeks)) {
          return {
            ok: true,
            seconds: out.publish?.seconds ?? 0,
            weeks: out.weeks,
          };
        }
        return {
          ok: false,
          message: out.error ?? `the regrade failed (${res.status})`,
          stderr: out.stderr,
        };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
    [post],
  );

  return { saving, load, save, regrade };
}
