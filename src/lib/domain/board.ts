/**
 * Modèle du tableau de production, réduit à quatre colonnes.
 *
 * Les étapes fines (production, arrangement, mixage, mastering) ne sont plus
 * des colonnes : elles deviennent une sous-étape interne de la colonne
 * « En cours ». Les jalons d'édition (envoyée, signée, sortie) ne sont pas non
 * plus des colonnes : ils se déduisent des envois et de la date de sortie, et
 * s'affichent comme statuts secondaires sur la carte.
 *
 * Les étapes existantes en base sont conservées : on ne fait que les regrouper.
 */

import { daysSince, daysUntil, plural } from "@/lib/format";
import type { LabelSubmission, PromotionTask, Stage, Track, TrackTask } from "@/lib/types";
import { CLOSED_STATUSES, submissionTiming } from "./submissions";

export type ColumnId = "idees" | "en_cours" | "finalisation" | "terminees";

export const COLUMNS: { id: ColumnId; name: string; hint: string }[] = [
  { id: "idees", name: "Idées", hint: "À explorer" },
  { id: "en_cours", name: "En cours", hint: "En production" },
  { id: "finalisation", name: "Finalisation", hint: "Prête à placer" },
  { id: "terminees", name: "Terminées", hint: "Sorties ou archivées" },
];

/** Sous-étapes de la colonne « En cours ». */
export const SUB_STEPS = ["production", "arrangement", "mixage", "mastering"] as const;
export type SubStep = (typeof SUB_STEPS)[number];

export const SUB_STEP_LABEL: Record<SubStep, string> = {
  production: "Production",
  arrangement: "Arrangement",
  mixage: "Mixage",
  mastering: "Mastering",
};

/** Étape de référence pour chaque colonne, utilisée lors d'un déplacement. */
const COLUMN_DEFAULT_KEY: Record<ColumnId, string> = {
  idees: "idee",
  en_cours: "production",
  finalisation: "prete_a_envoyer",
  terminees: "sortie",
};

const KEY_TO_COLUMN: Record<string, ColumnId> = {
  idee: "idees",
  production: "en_cours",
  arrangement: "en_cours",
  mixage: "en_cours",
  mastering: "en_cours",
  prete_a_envoyer: "finalisation",
  envoyee: "finalisation",
  signee: "finalisation",
  sortie: "terminees",
  archivee: "terminees",
};

/** Colonne d'une track, déduite de son étape enregistrée. */
export function columnOf(stage: Stage | undefined): ColumnId {
  if (!stage) return "idees";
  return KEY_TO_COLUMN[stage.key] ?? "en_cours";
}

/** Sous-étape affichée, uniquement pertinente en colonne « En cours ». */
export function subStepOf(stage: Stage | undefined): SubStep | null {
  if (!stage) return null;
  return (SUB_STEPS as readonly string[]).includes(stage.key) ? (stage.key as SubStep) : null;
}

/**
 * Étape à écrire en base pour placer une track dans une colonne.
 * On conserve la sous-étape courante quand elle appartient déjà à la colonne
 * visée, pour ne pas perdre l'information en déplaçant une carte.
 */
export function stageForColumn(
  column: ColumnId,
  stages: Stage[],
  current: Stage | undefined,
): Stage | undefined {
  if (current && columnOf(current) === column) return current;
  const preferred = stages.find((s) => s.key === COLUMN_DEFAULT_KEY[column] && !s.archived);
  if (preferred) return preferred;
  // Repli : la première étape non archivée rattachée à cette colonne.
  return stages.find((s) => !s.archived && columnOf(s) === column);
}

export function stageForSubStep(subStep: SubStep, stages: Stage[]): Stage | undefined {
  return stages.find((s) => s.key === subStep && !s.archived);
}

// --- Statut label ------------------------------------------------------------

export interface LabelStatus {
  text: string;
  tone: "neutre" | "info" | "warn" | "ok";
}

/**
 * Résumé de la situation d'une track côté labels, en une phrase.
 * Rien n'est affiché tant qu'aucun envoi n'existe : un compteur à zéro
 * n'apprend rien.
 */
export function labelStatusOf(submissions: LabelSubmission[]): LabelStatus | null {
  const active = submissions.filter((s) => !s.archived);
  if (active.length === 0) return null;

  if (active.some((s) => s.status === "signe")) {
    return { text: "Signée", tone: "ok" };
  }

  const positive = active.filter(
    (s) =>
      s.response_type === "positive" || ["interesse", "en_discussion"].includes(s.status),
  ).length;
  if (positive > 0) {
    return {
      text: positive === 1 ? "1 réponse positive" : `${positive} réponses positives`,
      tone: "ok",
    };
  }

  const toFollowUp = active.filter(
    (s) => !s.responded && submissionTiming(s).needsFollowup,
  ).length;
  if (toFollowUp > 0) {
    return { text: `${plural(toFollowUp, "relance")} à faire`, tone: "warn" };
  }

  const sent = active.filter((s) => s.sent_at);
  if (sent.length === 0) return { text: "Pas encore envoyée", tone: "neutre" };

  const waiting = sent.filter((s) => !s.responded && !CLOSED_STATUSES.includes(s.status));
  if (waiting.length > 0) {
    return {
      text:
        sent.length === 1
          ? "En attente de réponse"
          : `Envoyée à ${sent.length} labels · en attente`,
      tone: "info",
    };
  }

  return { text: `Envoyée à ${plural(sent.length, "label")}`, tone: "neutre" };
}

// --- Prochaine action --------------------------------------------------------

export interface NextAction {
  text: string;
  tone: "danger" | "warn" | "info" | "neutre";
}

/**
 * La seule chose à faire ensuite sur cette track, en une phrase.
 * L'ordre reflète l'urgence réelle : ce qui est en retard, puis ce qui
 * engage quelqu'un d'autre, puis le travail de production.
 */
export function nextActionOf(input: {
  tasks: TrackTask[];
  promoTasks: PromotionTask[];
  submissions: LabelSubmission[];
  labelName: (labelId: string) => string;
  releaseDate: string | null;
}): NextAction | null {
  const open = (status: string) => status === "a_faire" || status === "en_cours";

  const overdue = input.tasks
    .filter((t) => open(t.status) && t.due_date && (daysSince(t.due_date) ?? 0) > 0)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
  if (overdue) {
    const late = daysSince(overdue.due_date) ?? 0;
    return { text: `${overdue.title} · en retard de ${plural(late, "jour")}`, tone: "danger" };
  }

  const followUp = input.submissions
    .filter((s) => !s.archived && !s.responded && submissionTiming(s).needsFollowup)
    .sort((a, b) => (a.followup_due_date ?? "").localeCompare(b.followup_due_date ?? ""))[0];
  if (followUp) {
    return { text: `Relancer ${input.labelName(followUp.label_id)}`, tone: "warn" };
  }

  const promo = input.promoTasks
    .filter((t) => open(t.status) && t.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
  if (promo) {
    const until = daysUntil(promo.due_date) ?? 99;
    if (until <= 7) {
      return {
        text: promo.title,
        tone: until < 0 ? "danger" : until <= 2 ? "warn" : "info",
      };
    }
  }

  const started = input.tasks.find((t) => t.status === "en_cours");
  if (started) return { text: `Continuer : ${started.title}`, tone: "info" };

  const next = input.tasks
    .filter((t) => t.status === "a_faire")
    .sort((a, b) => a.position - b.position)[0];
  if (next) return { text: next.title, tone: "neutre" };

  return null;
}

/** Compte à rebours lisible avant une sortie. */
export function releaseCountdown(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const days = daysUntil(releaseDate);
  if (days === null) return null;
  if (days === 0) return "Sortie aujourd'hui";
  if (days === 1) return "Sortie demain";
  if (days > 0) return `Dans ${plural(days, "jour")}`;
  return `Sortie il y a ${plural(Math.abs(days), "jour")}`;
}

/** Alias court affiché sur les cartes. */
export function aliasLabel(workspaceName: string | undefined): string | null {
  if (!workspaceName) return null;
  if (/remix/i.test(workspaceName)) return "Remix";
  return workspaceName;
}
