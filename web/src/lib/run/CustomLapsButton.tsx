"use client";

import { useState } from "react";

import { Modal } from "@/lib/ux/primitives/Modal";
import { CustomLapsModal } from "./CustomLapsModal";
import { useStreams } from "./hooks/useStreams";

/** The **Custom Laps** button and the dialog behind it.
 *
 * IT OWNS THE `open` STATE AND THE FETCH, so `RunDetail` gains one element and
 * no bookkeeping. That also means the samples are requested by the thing that
 * needs them rather than by a parent passing them down -- and the request does
 * not happen until `open` goes true.
 *
 * THE DIALOG'S CONTENTS ARE A SEPARATE COMPONENT. This one is about opening;
 * `CustomLapsModal` is about cutting. Keeping them apart is what lets the cut
 * form be tested without a dialog and the dialog without a run.
 */
export function CustomLapsButton({ activityId }: { activityId: number }) {
  const [open, setOpen] = useState(false);
  const { streams, loading, error } = useStreams(activityId, open);

  return (
    <>
      {/* NOT `.ghost`, which is transparent and which the athlete could barely
          see. `.custom-laps-open` carries a resting fill -- see globals.css for
          why that matters and why `.ghost` was not widened instead. */}
      <button
        type="button"
        className="custom-laps-open"
        onClick={() => setOpen(true)}
      >
        Custom Laps
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Custom Laps">
        {loading ? <p className="note">Loading the run&rsquo;s sample data…</p> : null}
        {/* The sentence the hook composed, which names the status -- a 404 here
            means the run recorded no samples, which is a different thing from a
            failure and calls for a different response. */}
        {error ? <p className="note">{error}</p> : null}
        {streams ? <CustomLapsModal streams={streams} /> : null}
      </Modal>
    </>
  );
}
