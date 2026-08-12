/**
 * Logique métier des envois aux labels.
 *
 * Principes :
 *   - une réponse appartient toujours à un envoi précis, jamais au label ;
 *   - « Répondu » est déduit de la présence d'une date de réponse
 *     (responded est une colonne générée en base) ;
 *   - une relance crée un rappel, jamais un e-mail automatique.
 */

import { addDays, format } from "date-fns";
import { daysSince, plural, toDate } from "@/lib/format";
import type { Label, LabelSubmission, ResponseType, SubmissionStatus, Track } from "@/lib/types";

/** Statuts considérés comme « en attente d'une réponse ». */
export const PENDING_STATUSES: SubmissionStatus[] = [
  "envoye",
  "en_attente",
  "a_relancer",
];

/** Statuts qui n'attendent plus rien de la part du label. */
export const CLOSED_STATUSES: SubmissionStatus[] = [
  "refuse",
  "signe",
  "sans_reponse",
  "archive",
];

export type TimingTone = "neutre" | "info" | "warn" | "danger" | "ok";

export interface SubmissionTiming {
  /** Phrase principale affichée dans le tableau de suivi. */
  label: string;
  tone: TimingTone;
  /** Jours écoulés depuis l'envoi, null si pas encore envoyé. */
  sentDays: number | null;
  /** Jours de retard sur la relance (positif = en retard). */
  followupOverdueDays: number | null;
  needsFollowup: boolean;
}

/**
 * Phrase de suivi d'un envoi, telle qu'affichée dans les listes :
 * « Envoyé il y a 8 jours », « Relance prévue demain »,
 * « Relance en retard de 3 jours », « Réponse reçue après 12 jours »,
 * « Aucune réponse après 30 jours ».
 */
export function submissionTiming(
  submission: LabelSubmission,
  inactivityThreshold = 30,
): SubmissionTiming {
  const sentDays = daysSince(submission.sent_at);

  if (submission.responded_at) {
    const sent = toDate(submission.sent_at);
    const answered = toDate(submission.responded_at);
    if (sent && answered) {
      const delay = Math.max(
        0,
        Math.round((answered.getTime() - sent.getTime()) / 86_400_000),
      );
      return {
        label: delay === 0 ? "Réponse reçue le jour même" : `Réponse reçue après ${plural(delay, "jour")}`,
        tone: submission.response_type === "negative" ? "neutre" : "ok",
        sentDays,
        followupOverdueDays: null,
        needsFollowup: false,
      };
    }
    return {
      label: "Réponse reçue",
      tone: "ok",
      sentDays,
      followupOverdueDays: null,
      needsFollowup: false,
    };
  }

  if (!submission.sent_at) {
    return {
      label: submission.status === "pret_a_envoyer" ? "Prêt à envoyer" : "Pas encore envoyé",
      tone: "neutre",
      sentDays: null,
      followupOverdueDays: null,
      needsFollowup: false,
    };
  }

  const followupDelta = submission.followup_due_date
    ? (daysSince(submission.followup_due_date) ?? null)
    : null;

  if (followupDelta !== null) {
    if (followupDelta > 0) {
      return {
        label: `Relance en retard de ${plural(followupDelta, "jour")}`,
        tone: "danger",
        sentDays,
        followupOverdueDays: followupDelta,
        needsFollowup: true,
      };
    }
    if (followupDelta === 0) {
      return {
        label: "Relance prévue aujourd'hui",
        tone: "warn",
        sentDays,
        followupOverdueDays: 0,
        needsFollowup: true,
      };
    }
    if (followupDelta === -1) {
      return {
        label: "Relance prévue demain",
        tone: "info",
        sentDays,
        followupOverdueDays: followupDelta,
        needsFollowup: false,
      };
    }
    return {
      label: `Relance prévue dans ${plural(Math.abs(followupDelta), "jour")}`,
      tone: "info",
      sentDays,
      followupOverdueDays: followupDelta,
      needsFollowup: false,
    };
  }

  if (sentDays !== null && sentDays >= inactivityThreshold) {
    return {
      label: `Aucune réponse après ${plural(sentDays, "jour")}`,
      tone: "warn",
      sentDays,
      followupOverdueDays: null,
      needsFollowup: true,
    };
  }

  return {
    label: sentDays === 0 ? "Envoyé aujourd'hui" : `Envoyé il y a ${plural(sentDays ?? 0, "jour")}`,
    tone: "info",
    sentDays,
    followupOverdueDays: null,
    needsFollowup: false,
  };
}

/**
 * Statut à appliquer lorsqu'une réponse est enregistrée.
 * Une réponse négative bascule automatiquement en « Refusé » ;
 * l'historique (message, date) reste conservé sur l'envoi.
 */
export function statusAfterResponse(
  responseType: ResponseType,
  current: SubmissionStatus,
): SubmissionStatus {
  if (responseType === "negative") return "refuse";
  if (CLOSED_STATUSES.includes(current) && current !== "archive") return current;
  return "reponse_recue";
}

/** Date de relance proposée par défaut à partir d'une date d'envoi. */
export function suggestFollowupDate(sentAt: string | null, days: number): string | null {
  if (days <= 0) return null;
  const base = toDate(sentAt) ?? new Date();
  return format(addDays(base, days), "yyyy-MM-dd");
}

/** Envois déjà existants entre cette track et ce label (détection de doublon). */
export function findExistingSubmissions(
  submissions: LabelSubmission[],
  trackId: string,
  labelId: string,
  excludeId?: string,
): LabelSubmission[] {
  return submissions.filter(
    (s) => s.track_id === trackId && s.label_id === labelId && s.id !== excludeId,
  );
}

export interface SubmissionStats {
  total: number;
  sent: number;
  pending: number;
  responded: number;
  positive: number;
  negative: number;
  signed: number;
  noAnswer: number;
  overdueFollowups: number;
  /** Taux de réponse sur les envois réellement partis. */
  responseRate: number;
  /** Délai moyen de réponse en jours, null si aucune réponse. */
  averageResponseDays: number | null;
  lastInteraction: string | null;
}

export function computeSubmissionStats(
  submissions: LabelSubmission[],
  inactivityThreshold = 30,
): SubmissionStats {
  const sentOnes = submissions.filter((s) => Boolean(s.sent_at));
  const responded = submissions.filter((s) => s.responded);
  const delays: number[] = [];

  for (const s of responded) {
    const sent = toDate(s.sent_at);
    const answered = toDate(s.responded_at);
    if (sent && answered) {
      delays.push(Math.max(0, Math.round((answered.getTime() - sent.getTime()) / 86_400_000)));
    }
  }

  const noAnswer = sentOnes.filter((s) => {
    if (s.responded) return false;
    const age = daysSince(s.sent_at);
    return age !== null && age >= inactivityThreshold;
  }).length;

  const overdueFollowups = submissions.filter(
    (s) => !s.responded && submissionTiming(s, inactivityThreshold).needsFollowup,
  ).length;

  const dates = submissions
    .map((s) => s.responded_at ?? s.last_followup_at ?? s.sent_at)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    total: submissions.length,
    sent: sentOnes.length,
    pending: sentOnes.filter((s) => !s.responded && !CLOSED_STATUSES.includes(s.status)).length,
    responded: responded.length,
    positive: responded.filter(
      (s) =>
        s.response_type === "positive" ||
        ["interesse", "en_discussion", "signe"].includes(s.status),
    ).length,
    negative: responded.filter((s) => s.response_type === "negative" || s.status === "refuse")
      .length,
    signed: submissions.filter((s) => s.status === "signe").length,
    noAnswer,
    overdueFollowups,
    responseRate: sentOnes.length === 0 ? 0 : (responded.length / sentOnes.length) * 100,
    averageResponseDays:
      delays.length === 0
        ? null
        : Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10,
    lastInteraction: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

/** Modèle d'e-mail prérempli, ouvert dans l'application e-mail du système. */
export function buildMailto(
  label: Label,
  track: Track | null,
  options: { alias?: string; privateLink?: string | null; message?: string | null } = {},
): string {
  const to = label.email ?? "";
  const alias = options.alias ?? "";
  const subject = track
    ? `Démo — ${alias ? `${alias} — ` : ""}${track.title}${track.genre ? ` (${track.genre})` : ""}`
    : "Démo";

  const body =
    options.message ??
    [
      `Bonjour${label.contact_name ? ` ${label.contact_name}` : ""},`,
      "",
      track
        ? `Je vous envoie ma nouvelle track « ${track.title} »${
            track.genre ? `, ${track.genre}` : ""
          }${track.bpm ? ` à ${track.bpm} BPM` : ""}${
            track.musical_key ? ` en ${track.musical_key}` : ""
          }.`
        : "Je vous envoie ma nouvelle track.",
      options.privateLink ? `` : "",
      options.privateLink ? `Lien d'écoute privé : ${options.privateLink}` : "",
      "",
      "Merci pour votre écoute et votre retour.",
      "",
      alias || "",
    ]
      .filter((line) => line !== undefined)
      .join("\n");

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
