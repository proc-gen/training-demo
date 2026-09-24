import { useCallback, useState } from "react";

import type { Json, RejectedTemplate, RunTemplate } from "@/lib/manifest/runTemplates";

/* The editor's channel to `/api/run-templates` -- `useManifestEditor`'s shape
 * one resource over, and for the same reason: a client component may not reach
 * `lib/manifest/manifestIo`, so fetch is how the authored templates file gets
 * to the browser.
 *
 * `fetcher` IS INJECTED, defaulting to the real `fetch`. A prop needs no module
 * registry, so a test's fake cannot leak into another file's render -- which
 * matters here more than usual, because the render project reuses one jsdom and
 * one module registry across files.
 *
 * THREE COMPONENTS CALL THIS AND EACH GETS ITS OWN STATE: the picker lists, the
 * run head saves, the manager does all four. They do not share a cache, which
 * is why each LOADS ON OPEN -- a template saved a moment ago is in the file by
 * then, and an archive from one dialog must not leave a stale row in another.
 *
 * `saving` COVERS ALL THREE WRITES, deliberately. A dialog may have exactly one
 * write in flight -- a Save that raced a Delete would leave the file settled by
 * whichever finished last -- so one flag disabling every button is the
 * behaviour wanted rather than a shortcut taken.
 */

export type TemplateList = {
  templates: RunTemplate[];
  rejected: RejectedTemplate[];
  /** Ids some authored run was built from -- only present when `list(true)`
   *  asked. It is what the delete confirmation words itself from; the ROUTE
   *  reads it again to act, because this copy is as old as the last fetch. */
  used?: string[];
};

export type TemplateFetch =
  | ({ ok: true } & TemplateList)
  | { ok: false; message: string };

export type TemplateSave =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; message: string; issues?: string[] };

/** What a `PUT` came back with. NO `duplicate`: a create can answer "you
 *  already have this one" and an edit that collides is a refusal instead --
 *  the two rows have different ids and runs may already name both. */
export type TemplateUpdate =
  | { ok: true; id: string }
  | { ok: false; message: string; issues?: string[] };

/** What a `DELETE` came back with. `action` is the ROUTE's answer, not the
 *  browser's guess: a template some run was built from is archived rather than
 *  removed, so the link on that run cannot dangle. */
export type TemplateRemove =
  | { ok: true; id: string; action: "deleted" | "archived" }
  | { ok: false; message: string };

export function useRunTemplates(fetcher: typeof fetch = fetch) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Every ACTIVE template, and optionally which of them are in use.
   *
   * `usage` IS OPT-IN because it costs the server a sweep of every authored
   * week. The manager needs it to word its confirmation; the picker does not,
   * and would pay for it on every open of a dropdown. */
  const list = useCallback(
    async (usage = false): Promise<TemplateFetch> => {
      setLoading(true);
      try {
        const res = await fetcher(
          usage ? "/api/run-templates?usage=1" : "/api/run-templates",
        );
        const body = (await res.json()) as Partial<TemplateList> & {
          error?: string;
        };
        if (res.ok && Array.isArray(body.templates)) {
          return {
            ok: true,
            templates: body.templates,
            rejected: body.rejected ?? [],
            used: body.used,
          };
        }
        return {
          ok: false,
          message: body.error ?? `the template request failed (${res.status})`,
        };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        };
      } finally {
        setLoading(false);
      }
    },
    [fetcher],
  );

  const save = useCallback(
    async (run: Json): Promise<TemplateSave> => {
      setSaving(true);
      try {
        const res = await fetcher("/api/run-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ run }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
          id?: string;
          duplicate?: boolean;
          error?: string;
          issues?: string[];
        };
        if (res.ok && body.ok && body.id) {
          return { ok: true, id: body.id, duplicate: body.duplicate === true };
        }
        return {
          ok: false,
          message:
            body.error ??
            (body.issues?.length
              ? "the template was refused"
              : `the save failed (${res.status})`),
          issues: body.issues,
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

  /** Edit an existing template. THE ID DOES NOT MOVE -- runs carry it. */
  const update = useCallback(
    async (id: string, run: Json): Promise<TemplateUpdate> => {
      setSaving(true);
      try {
        const res = await fetcher("/api/run-templates", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, run }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
          id?: string;
          error?: string;
          issues?: string[];
        };
        if (res.ok && body.ok && body.id) return { ok: true, id: body.id };
        return {
          ok: false,
          message:
            body.error ??
            (body.issues?.length
              ? "the template was refused"
              : `the save failed (${res.status})`),
          issues: body.issues,
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

  /** Retire a template. The ROUTE decides whether that is a delete or an
   *  archive, and says which it did -- see `TemplateRemove`. */
  const remove = useCallback(
    async (id: string): Promise<TemplateRemove> => {
      setSaving(true);
      try {
        const res = await fetcher(
          `/api/run-templates?id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        const body = (await res.json()) as {
          ok?: boolean;
          id?: string;
          action?: "deleted" | "archived";
          error?: string;
        };
        if (res.ok && body.ok && body.id && body.action) {
          return { ok: true, id: body.id, action: body.action };
        }
        return {
          ok: false,
          message: body.error ?? `the delete failed (${res.status})`,
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

  return { loading, saving, list, save, update, remove };
}
