"use client";

import type { Week } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { Note } from "@/lib/ux/primitives/Note";
import { NotePanel } from "./NotePanel";

/** The hand-authored commentary.
 *
 * THE REASON THE PAGE EXISTS. No script writes a note -- the graders print to
 * stdout and forget -- so for many numbers the notes were the only surviving
 * copy. Numbers come from the graders, prose comes from the notes, and neither
 * is transcribed twice.
 */
export function NotesCard({ week }: { week: Week }) {
  const a = week.notes?.adherence;
  const l = week.notes?.load;
  if (!a && !l) return null;

  return (
    <Card title="Commentary">
      <Note>
        Hand-authored commentary, carried verbatim from notes/. The numbers above
        come from the graders; this is the narrative around them.
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
    </Card>
  );
}
