"use client";

import { useMemo, useState } from "react";
import { computeSubmissionStats } from "@/lib/domain/submissions";
import { useDerived } from "@/lib/store/selectors";
import { Button, Modal } from "@/components/ui";
import { IconPlus } from "@/components/ui/icons";
import { SubmissionCounters, SubmissionList } from "@/components/labels/submission-list";
import { SubmissionForm } from "@/components/labels/submission-form";
import type { Track } from "@/lib/types";

/** Historique des envois de cette track : où elle en est, label par label. */
export function LabelsTab({ track }: { track: Track }) {
  const { submissionsByTrack } = useDerived();
  const [adding, setAdding] = useState(false);

  const submissions = useMemo(
    () =>
      (submissionsByTrack.get(track.id) ?? [])
        .slice()
        .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at)),
    [submissionsByTrack, track.id],
  );

  const stats = useMemo(() => computeSubmissionStats(submissions), [submissions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <IconPlus size={16} />
          Enregistrer un envoi
        </Button>
      </div>

      {submissions.length > 0 ? <SubmissionCounters stats={stats} /> : null}

      <SubmissionList
        submissions={submissions}
        show="label"
        emptyMessage="Enregistrez le premier envoi de cette track à un label."
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Nouvel envoi"
        size="lg"
      >
        <SubmissionForm
          defaultTrackId={track.id}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </div>
  );
}
