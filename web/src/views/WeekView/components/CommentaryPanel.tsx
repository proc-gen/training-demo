"use client";

import type { Week } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { NotePanel } from "./NotePanel";

/** The hand-authored commentary.
 *
 * THE REASON THE PAGE EXISTS. No script writes a note -- the graders print to
 * stdout and forget -- so for many numbers the notes were the only surviving
 * copy. Numbers come from the graders, prose comes from the notes, and neither
 * is transcribed twice.
 *
 * The null guard stays even though `weekPanels` will not offer the tab for a
 * week with no note: this is a component, and a component that renders an empty
 * shell when handed nothing is one refactor away from doing it on the page.
 */
export function CommentaryPanel({ week }: { week: Week }) {
  const a = week.notes?.adherence;
  const l = week.notes?.load;
  if (!a && !l) return null;

  return (
    <>
      <Note>
        Hand-authored commentary, carried verbatim from notes/. The numbers on
        the other tabs come from the graders; this is the narrative around them.
      </Note>
      {a ? (
        <NotePanel
          summary={`Adherence note — notes/week-${week.week_start}.md`}
          html={a}
        />
      ) : null}
      {l ? (
        <NotePanel
          summary={`Load note — notes/load/week-${week.week_start}.md`}
          html={l}
        />
      ) : null}
    </>
  );
}
