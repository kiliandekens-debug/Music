"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/lib/constants";
import { formatDate, todayIso } from "@/lib/format";
import { buildMailto, submissionTiming } from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  cn,
} from "@/components/ui";
import { IconMore } from "@/components/ui/icons";
import { RespondedDialog } from "./responded-dialog";
import { SubmissionForm } from "./submission-form";
import type { LabelSubmission, SubmissionStatus } from "@/lib/types";

const TIMING_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-muted",
  neutre: "text-faint",
};

/**
 * Liste des envois, en lignes compactes.
 * Utilisée sur la fiche d'une track (on y lit les labels) et sur la fiche d'un
 * label (on y lit les tracks).
 */
export function SubmissionList({
  submissions,
  show,
  emptyMessage,
}: {
  submissions: LabelSubmission[];
  show: "label" | "track";
  emptyMessage?: string;
}) {
  const { labels, tracks, update, remove, insert } = useData();
  const [responding, setResponding] = useState<LabelSubmission | null>(null);
  const [editing, setEditing] = useState<LabelSubmission | null>(null);

  async function registerFollowup(submission: LabelSubmission) {
    await update("label_submissions", submission.id, {
      last_followup_at: todayIso(),
      followup_count: submission.followup_count + 1,
      status: "en_attente",
      followup_due_date: null,
    });
    const label = labels.find((l) => l.id === submission.label_id);
    await insert("reminders", {
      track_id: submission.track_id,
      title: `Relance effectuée — ${label?.name ?? "label"}`,
      kind: "relance_label",
      entity_type: "label_submission",
      entity_id: submission.id,
      due_at: new Date().toISOString(),
      done_at: new Date().toISOString(),
    });
  }

  if (submissions.length === 0) {
    return (
      <p className="py-2 text-[13px] text-muted">
        {emptyMessage ?? "Aucun envoi enregistré."}
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {submissions.map((submission) => {
          const label = labels.find((l) => l.id === submission.label_id);
          const track = tracks.find((t) => t.id === submission.track_id);
          const timing = submissionTiming(submission);

          return (
            <li key={submission.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {show === "label" ? (
                    <span className="truncate text-[14px] font-medium text-ink">
                      {label?.name ?? "Label supprimé"}
                    </span>
                  ) : (
                    <Link
                      href={`/studio/${submission.track_id}`}
                      className="truncate text-[14px] font-medium text-ink hover:text-accent-ink"
                    >
                      {track?.title ?? "Track supprimée"}
                    </Link>
                  )}
                  <Badge tone={SUBMISSION_STATUS_TONE[submission.status]}>
                    {SUBMISSION_STATUS_LABEL[submission.status]}
                  </Badge>
                </div>

                <p className={cn("mt-0.5 text-[12px]", TIMING_TONE[timing.tone])}>
                  {timing.label}
                  {submission.sent_at ? ` · envoyé le ${formatDate(submission.sent_at, "d MMM")}` : ""}
                </p>

                {submission.response_message ? (
                  <p className="mt-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] leading-snug text-ink-soft">
                    {submission.response_message}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Checkbox
                  checked={submission.responded}
                  onChange={(checked) => {
                    if (checked) setResponding(submission);
                    else
                      void update("label_submissions", submission.id, {
                        responded_at: null,
                        response_type: null,
                        status: "en_attente",
                      });
                  }}
                  label={<span className="text-[12px] text-muted">Répondu</span>}
                />

                <Menu
                  trigger={(props) => (
                    <IconButton label="Actions" {...props}>
                      <IconMore size={16} />
                    </IconButton>
                  )}
                >
                  <MenuItem onClick={() => setEditing(submission)}>Modifier l&apos;envoi</MenuItem>
                  <MenuItem
                    disabled={!submission.sent_at || submission.responded}
                    onClick={() => void registerFollowup(submission)}
                  >
                    Marquer comme relancé aujourd&apos;hui
                  </MenuItem>
                  {label?.email ? (
                    <MenuItem
                      onClick={() => {
                        window.location.href = buildMailto(label, track ?? null, {
                          privateLink: submission.private_link,
                        });
                      }}
                    >
                      Écrire à {label.email}
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuLabel>Statut</MenuLabel>
                  {(
                    [
                      "envoye",
                      "en_attente",
                      "a_relancer",
                      "interesse",
                      "en_discussion",
                      "signe",
                      "refuse",
                      "sans_reponse",
                    ] as SubmissionStatus[]
                  ).map((status) => (
                    <MenuItem
                      key={status}
                      disabled={submission.status === status}
                      onClick={() => void update("label_submissions", submission.id, { status })}
                    >
                      {SUBMISSION_STATUS_LABEL[status]}
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem
                    destructive
                    onClick={() => void remove("label_submissions", submission.id)}
                  >
                    Supprimer
                  </MenuItem>
                </Menu>
              </div>
            </li>
          );
        })}
      </ul>

      <RespondedDialog
        submission={responding}
        open={responding !== null}
        onClose={() => setResponding(null)}
      />

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier l'envoi" size="lg">
        {editing ? (
          <SubmissionForm
            submission={editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
