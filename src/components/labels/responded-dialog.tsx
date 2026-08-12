"use client";

import { useState } from "react";
import { todayIso } from "@/lib/format";
import { statusAfterResponse } from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import { Button, Field, Input, Modal, Textarea, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { LabelSubmission, ResponseType } from "@/lib/types";

/**
 * Enregistrement d'une réponse de label.
 * Cocher « Répondu » revient à renseigner une date de réponse, qui reste la
 * seule source de vérité. On ne demande que trois choses : quand, dans quel
 * sens, et ce qui a été dit.
 */
export function RespondedDialog({
  submission,
  open,
  onClose,
}: {
  submission: LabelSubmission | null;
  open: boolean;
  onClose: () => void;
}) {
  const { labels, tracks, update, log, reminders } = useData();
  const toast = useToast();

  const [respondedAt, setRespondedAt] = useState(todayIso());
  const [responseType, setResponseType] = useState<ResponseType>("positive");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  if (!submission) return null;

  const label = labels.find((l) => l.id === submission.label_id);
  const track = tracks.find((t) => t.id === submission.track_id);

  async function save() {
    if (!submission) return;
    setBusy(true);
    try {
      const status = statusAfterResponse(responseType, submission.status);

      await update("label_submissions", submission.id, {
        responded_at: respondedAt,
        response_type: responseType,
        response_message: comment.trim() || null,
        status,
        // La relance n'a plus lieu d'être une fois la réponse reçue.
        followup_due_date: null,
      });

      // Le rappel de relance associé est clos.
      const linked = reminders.find(
        (r) => r.entity_id === submission.id && r.kind === "relance_label" && !r.done_at,
      );
      if (linked) {
        await update("reminders", linked.id, { done_at: new Date().toISOString() });
      }

      log({
        entity_type: "label_submission",
        entity_id: submission.id,
        track_id: submission.track_id,
        action: "reponse_recue",
        summary: `Réponse ${responseType === "negative" ? "négative" : "positive"} de ${
          label?.name ?? "un label"
        } sur « ${track?.title ?? "Track"} »`,
      });

      toast.success("Réponse enregistrée");
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Réponse du label"
      description={label && track ? `${label.name} — ${track.title}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date de la réponse" required>
          <Input type="date" value={respondedAt} onChange={(e) => setRespondedAt(e.target.value)} />
        </Field>

        <Field label="Réponse">
          <div className="flex gap-2">
            {(
              [
                ["positive", "Positive"],
                ["negative", "Négative"],
              ] as [ResponseType, string][]
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={responseType === value}
                onClick={() => setResponseType(value)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-100",
                  responseType === value
                    ? value === "positive"
                      ? "border-ok bg-ok/15 text-ok"
                      : "border-danger bg-danger/10 text-danger"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Commentaire" hint="Facultatif.">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Ce que le label a répondu"
          />
        </Field>
      </div>
    </Modal>
  );
}
