"use client";

import { useState } from "react";
import { RESPONSE_TYPE_LABEL } from "@/lib/constants";
import { todayIso } from "@/lib/format";
import { statusAfterResponse } from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import { Button, Field, Input, Modal, Select, Textarea, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { LabelSubmission, ResponseType, SubmissionStatus } from "@/lib/types";

/**
 * Enregistrement d'une réponse de label.
 * La case « Répondu » du tableau ouvre cette fenêtre : cocher revient à
 * renseigner une date de réponse, qui est la seule source de vérité.
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
  const { labels, tracks, update, insert, log, reminders } = useData();
  const toast = useToast();

  const [respondedAt, setRespondedAt] = useState(todayIso());
  const [responseType, setResponseType] = useState<ResponseType>("positive");
  const [responseMessage, setResponseMessage] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [positiveStatus, setPositiveStatus] = useState<SubmissionStatus>("interesse");
  const [busy, setBusy] = useState(false);

  if (!submission) return null;

  const label = labels.find((l) => l.id === submission.label_id);
  const track = tracks.find((t) => t.id === submission.track_id);

  async function save() {
    if (!submission) return;
    setBusy(true);
    try {
      const status =
        responseType === "positive"
          ? positiveStatus
          : statusAfterResponse(responseType, submission.status);

      await update("label_submissions", submission.id, {
        responded_at: respondedAt,
        response_type: responseType,
        response_message: responseMessage.trim() || null,
        next_action: nextAction.trim() || null,
        next_action_date: nextActionDate || null,
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

      if (nextAction.trim() && nextActionDate) {
        await insert("reminders", {
          track_id: submission.track_id,
          title: `${nextAction.trim()} — ${label?.name ?? "label"}`,
          kind: "relance_label",
          entity_type: "label_submission",
          entity_id: submission.id,
          due_at: new Date(`${nextActionDate}T09:00:00`).toISOString(),
        });
      }

      // Une signature met la track sur la voie de la sortie.
      if (status === "signe" && submission.track_id) {
        log({
          entity_type: "label_submission",
          entity_id: submission.id,
          track_id: submission.track_id,
          action: "signature",
          summary: `« ${track?.title ?? "Track"} » signée chez ${label?.name ?? "un label"}`,
        });
      } else {
        log({
          entity_type: "label_submission",
          entity_id: submission.id,
          track_id: submission.track_id,
          action: "reponse_recue",
          summary: `Réponse ${RESPONSE_TYPE_LABEL[responseType].toLowerCase()} de ${
            label?.name ?? "un label"
          } sur « ${track?.title ?? "Track"} »`,
        });
      }

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
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Enregistrer la réponse
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date de la réponse" required>
          <Input
            type="date"
            value={respondedAt}
            onChange={(e) => setRespondedAt(e.target.value)}
          />
        </Field>

        <Field label="Type de réponse">
          <Select
            value={responseType}
            onChange={(e) => setResponseType(e.target.value as ResponseType)}
          >
            {(Object.keys(RESPONSE_TYPE_LABEL) as ResponseType[]).map((type) => (
              <option key={type} value={type}>
                {RESPONSE_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>

        {responseType === "positive" ? (
          <div className="rounded-lg border border-ok/25 bg-ok/5 p-3">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ok">
              Suite à donner
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["interesse", "Marquer comme intéressé"],
                  ["en_discussion", "Passer en discussion"],
                  ["signe", "Marquer comme signé"],
                ] as [SubmissionStatus, string][]
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPositiveStatus(value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors",
                    positiveStatus === value
                      ? "border-ok bg-ok/15 text-ok"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {responseType === "negative" ? (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
            Le statut passera automatiquement à « Refusé ». L&apos;historique de l&apos;échange est
            conservé.
          </p>
        ) : null}

        <Field label="Message ou résumé de la réponse">
          <Textarea
            value={responseMessage}
            onChange={(e) => setResponseMessage(e.target.value)}
            rows={4}
            placeholder="Ce que le label a répondu"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prochaine action">
            <Input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Envoyer les stems, signer le contrat…"
            />
          </Field>
          <Field label="Date de la prochaine action">
            <Input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
