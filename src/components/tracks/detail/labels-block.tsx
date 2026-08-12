"use client";

import { useMemo, useState } from "react";
import { useDerived } from "@/lib/store/selectors";
import { Button, Modal } from "@/components/ui";
import { IconPlus } from "@/components/ui/icons";
import { SubmissionList } from "@/components/labels/submission-list";
import { SubmissionForm } from "@/components/labels/submission-form";
import type { Track } from "@/lib/types";

/** Où en est cette track côté labels, label par label. */
export function LabelsBlock({ track }: { track: Track }) {
  const { submissionsByTrack } = useDerived();
  const [adding, setAdding] = useState(false);

  const submissions = useMemo(
    () =>
      (submissionsByTrack.get(track.id) ?? [])
        .slice()
        .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at)),
    [submissionsByTrack, track.id],
  );

  return (
    <div>
      <SubmissionList
        submissions={submissions}
        show="label"
        emptyMessage="Cette track n'a encore été envoyée à aucun label."
      />

      <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)}>
        <IconPlus size={15} />
        Envoyer à un label
      </Button>

      <Modal open={adding} onClose={() => setAdding(false)} title="Envoyer à un label" size="lg">
        <SubmissionForm
          defaultTrackId={track.id}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </div>
  );
}
