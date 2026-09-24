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
  | { ok: true; manifest: Record<string, unknown> }
  | { ok: false; missing: boolean; message: string };

export type SaveOutcome =
  | { ok: true; seconds: number; grader: GraderStatus }
  | { ok: false; message: string; issues?: string[]; stderr?: string };

export function useManifestEditor(fetcher: typeof fetch = fetch) {
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (weekStart: string): Promise<ManifestFetch> => {
      try {
        const res = await fetcher(`/api/manifest?start=${weekStart}`);
        const body = (await res.json()) as {
          manifest?: Record<string, unknown>;
          error?: string;
        };
        if (res.ok && body.manifest) return { ok: true, manifest: body.manifest };
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

  const save = useCallback(
    async (body: unknown): Promise<SaveOutcome> => {
      setSaving(true);
      try {
        const res = await fetcher("/api/manifest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const out = (await res.json()) as {
          publish?: { seconds?: number };
          grader?: GraderStatus;
          error?: string;
          issues?: string[];
          stderr?: string;
        };
        if (res.ok && out.grader) {
          return {
            ok: true,
            seconds: out.publish?.seconds ?? 0,
            grader: out.grader,
          };
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
      } finally {
        setSaving(false);
      }
    },
    [fetcher],
  );

  return { saving, load, save };
}
