"use client";

import { useMemo, useState } from "react";
import {
  FOLLOWUP_PRESETS,
  SUBMISSION_METHOD_LABEL,
  SUBMISSION_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate, todayIso } from "@/lib/format";
import {
  buildMailto,
  findExistingSubmissions,
  suggestFollowupDate,
} from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import { Button, Checkbox, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { IconMail, IconWarning } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { LabelSubmission, SubmissionMethod, SubmissionStatus } from "@/lib/types";

/**
 * Formulaire d'envoi d'une track à un label.
 * Un envoi relie toujours une track précise à un label précis : la réponse
 * éventuelle est enregistrée sur cet envoi, jamais sur le label.
 */
export function SubmissionForm({
  submission,
  defaultTrackId,
  defaultLabelId,
  onDone,
  onCancel,
}: {
  submission?: LabelSubmission;
  defaultTrackId?: string;
  defaultLabelId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { tracks, labels, submissions, profile, insert, update, log, touchTrack } = useData();
  const toast = useToast();

  const followupDefault = profile?.default_followup_days ?? 10;
  const availableTracks = tracks.filter((t) => !t.archived);
  const availableLabels = labels.filter((l) => !l.archived);

  const [trackId, setTrackId] = useState(
    submission?.track_id ?? defaultTrackId ?? availableTracks[0]?.id ?? "",
  );
  const [labelId, setLabelId] = useState(
    submission?.label_id ?? defaultLabelId ?? availableLabels[0]?.id ?? "",
  );
  const [sentAt, setSentAt] = useState(submission?.sent_at ?? todayIso());
  const [markAsSent, setMarkAsSent] = useState(submission ? Boolean(submission.sent_at) : true);
  const [method, setMethod] = useState<SubmissionMethod>(submission?.method ?? "email");
  const [contactName, setContactName] = useState(submission?.contact_name ?? "");
  const [emailUsed, setEmailUsed] = useState(submission?.email_used ?? "");
  const [privateLink, setPrivateLink] = useState(submission?.private_link ?? "");
  const [message, setMessage] = useState(submission?.message ?? "");
  const [status, setStatus] = useState<SubmissionStatus>(submission?.status ?? "envoye");
  const [followupDays, setFollowupDays] = useState<number>(followupDefault);
  const [followupDate, setFollowupDate] = useState(
    submission?.followup_due_date ??
      suggestFollowupDate(todayIso(), followupDefault) ??
      "",
  );
  const [notes, setNotes] = useState(submission?.notes ?? "");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);

  const track = tracks.find((t) => t.id === trackId);
  const label = labels.find((l) => l.id === labelId);

  const duplicates = useMemo(
    () =>
      trackId && labelId
        ? findExistingSubmissions(submissions, trackId, labelId, submission?.id)
        : [],
    [submissions, trackId, labelId, submission?.id],
  );

  // Préremplit le contact et l'adresse à partir de la fiche du label.
  function applyLabelDefaults(nextLabelId: string) {
    setLabelId(nextLabelId);
    const next = labels.find((l) => l.id === nextLabelId);
    if (!next) return;
    if (!contactName) setContactName(next.contact_name ?? "");
    if (!emailUsed) setEmailUsed(next.email ?? "");
    setMethod(next.preferred_method);
  }

  function applyFollowupPreset(days: number | null) {
    if (days === null) {
      setFollowupDays(0);
      setFollowupDate("");
      return;
    }
    setFollowupDays(days);
    setFollowupDate(suggestFollowupDate(markAsSent ? sentAt : todayIso(), days) ?? "");
  }

  async function submit() {
    if (!trackId || !labelId) {
      toast.error("Choisissez une track et un label.");
      return;
    }
    if (duplicates.length > 0 && !confirmDuplicate && !submission) {
      toast.error("Confirmez qu'il s'agit d'un nouvel envoi.");
      return;
    }

    setBusy(true);
    const values = {
      track_id: trackId,
      label_id: labelId,
      contact_name: contactName.trim() || null,
      email_used: emailUsed.trim() || null,
      sent_at: markAsSent ? sentAt : null,
      method,
      private_link: privateLink.trim() || null,
      message: message.trim() || null,
      status: markAsSent ? status : "pret_a_envoyer",
      followup_due_date: markAsSent && followupDate ? followupDate : null,
      notes: notes.trim() || null,
    };

    try {
      if (submission) {
        await update("label_submissions", submission.id, values);
      } else {
        const created = await insert("label_submissions", values);
        log({
          entity_type: "label_submission",
          entity_id: created.id,
          track_id: trackId,
          action: "envoi_cree",
          summary: `« ${track?.title ?? "Track"} » envoyée à ${label?.name ?? "un label"}`,
        });

        // Un rappel de relance, jamais un envoi automatique.
        if (values.followup_due_date) {
          await insert("reminders", {
            track_id: trackId,
            title: `Relancer ${label?.name ?? "le label"} — ${track?.title ?? ""}`,
            kind: "relance_label",
            entity_type: "label_submission",
            entity_id: created.id,
            due_at: new Date(`${values.followup_due_date}T09:00:00`).toISOString(),
          });
        }
        toast.success("Envoi enregistré");
      }
      touchTrack(trackId);
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Track" required>
          <Select value={trackId} onChange={(e) => setTrackId(e.target.value)} required>
            <option value="">—</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Label" required>
          <Select
            value={labelId}
            onChange={(e) => applyLabelDefaults(e.target.value)}
            required
          >
            <option value="">—</option>
            {availableLabels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {duplicates.length > 0 ? (
        <div className="rounded-lg border border-warn/30 bg-warn/10 p-3">
          <div className="flex items-start gap-2.5">
            <IconWarning size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="space-y-2 text-[13px] text-ink-soft">
              <p>
                Cette track a déjà été envoyée à ce label
                {duplicates[0].sent_at ? ` le ${formatDate(duplicates[0].sent_at)}` : ""}.
              </p>
              {!submission ? (
                <Checkbox
                  checked={confirmDuplicate}
                  onChange={setConfirmDuplicate}
                  label="Il s'agit d'une nouvelle version ou d'un nouvel échange"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact utilisé">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="Adresse e-mail utilisée">
          <Input
            type="email"
            value={emailUsed}
            onChange={(e) => setEmailUsed(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Méthode d'envoi">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as SubmissionMethod)}
          >
            {(Object.keys(SUBMISSION_METHOD_LABEL) as SubmissionMethod[]).map((m) => (
              <option key={m} value={m}>
                {SUBMISSION_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Statut">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubmissionStatus)}
            disabled={!markAsSent}
          >
            {(Object.keys(SUBMISSION_STATUS_LABEL) as SubmissionStatus[]).map((s) => (
              <option key={s} value={s}>
                {SUBMISSION_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 p-3">
        <Checkbox
          checked={markAsSent}
          onChange={setMarkAsSent}
          label="La track a été envoyée"
        />
        {markAsSent ? (
          <div className="mt-3 space-y-3">
            <Field label="Date d'envoi">
              <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
            </Field>
            <Field label="Relance">
              <div className="flex flex-wrap items-center gap-1.5">
                {FOLLOWUP_PRESETS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => applyFollowupPreset(days)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12px] transition-colors",
                      followupDays === days && followupDate
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line text-muted hover:text-ink",
                    )}
                  >
                    dans {days} jours
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyFollowupPreset(null)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[12px] transition-colors",
                    !followupDate
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  aucune relance
                </button>
              </div>
            </Field>
            <Input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              aria-label="Date de relance"
            />
            <p className="text-[12px] text-faint">
              Un rappel est créé à cette date. Aucun e-mail n&apos;est envoyé automatiquement.
            </p>
          </div>
        ) : null}
      </div>

      <Field label="Lien privé envoyé">
        <Input
          value={privateLink}
          onChange={(e) => setPrivateLink(e.target.value)}
          placeholder="https://soundcloud.com/…"
        />
      </Field>

      <Field label="Message envoyé">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      </Field>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {label?.email ? (
          <a
            href={buildMailto(label, track ?? null, {
              privateLink,
              message: message.trim() || undefined,
            })}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink"
          >
            <IconMail size={16} />
            Ouvrir dans mon application e-mail
          </a>
        ) : (
          <span className="text-[12px] text-faint">
            {label ? "Aucune adresse e-mail sur ce label" : ""}
          </span>
        )}
        <div className="flex gap-2">
          {onCancel ? (
            <Button variant="ghost" type="button" onClick={onCancel}>
              Annuler
            </Button>
          ) : null}
          <Button variant="primary" type="submit" loading={busy}>
            {submission ? "Enregistrer" : "Enregistrer l'envoi"}
          </Button>
        </div>
      </div>
    </form>
  );
}
