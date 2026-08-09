"use client";

/** One hand-authored note, carried verbatim.
 *
 * The markdown was rendered to HTML in PYTHON, where it is pure logic and
 * tested, and it escapes before emitting any markup -- so the only tags here
 * are ones it wrote. DO NOT ADD A JS MARKDOWN RENDERER: that would be a second
 * implementation of the same thing, and the two would disagree.
 *
 * The prose is OPAQUE. Nothing parses it for meaning, it may contain anything
 * including its own headings, and it can be restructured freely without
 * breaking the build.
 */
export function NotePanel({ summary, html }: { summary: string; html: string }) {
  return (
    <details className="prose">
      <summary>{summary}</summary>
      <div className="prose-body" dangerouslySetInnerHTML={{ __html: html }} />
    </details>
  );
}
