/**
 * Moteur « Prochaine action ».
 *
 * Un moteur de règles, pas une intelligence artificielle : chaque suggestion
 * expose la règle qui l'a produite, afin que la recommandation reste toujours
 * explicable et prévisible. L'ordre des règles suit celui défini avec le
 * producteur ; l'utilisateur peut de toute façon épingler manuellement une
 * autre action.
 */

import { daysSince, daysUntil } from "@/lib/format";
import { submissionTiming } from "./submissions";
import { trackProgress } from "./progress";
import type {
  Label,
  LabelSubmission,
  PromotionTask,
  Track,
  TrackTask,
} from "@/lib/types";

export type RuleId =
  | "tache_urgente"
  | "relance_label"
  | "promo_sortie_proche"
  | "track_prioritaire_inactive"
  | "tache_commencee"
  | "track_presque_finie";

export const RULE_LABEL: Record<RuleId, string> = {
  tache_urgente: "Tâche urgente ou en retard",
  relance_label: "Relance label à faire",
  promo_sortie_proche: "Promotion d'une sortie proche",
  track_prioritaire_inactive: "Track prioritaire sans activité",
  tache_commencee: "Tâche déjà commencée",
  track_presque_finie: "Track proche d'être terminée",
};

/** Poids de base par règle : plus petit = plus prioritaire. */
const RULE_RANK: Record<RuleId, number> = {
  tache_urgente: 0,
  relance_label: 1,
  promo_sortie_proche: 2,
  track_prioritaire_inactive: 3,
  tache_commencee: 4,
  track_presque_finie: 5,
};

export interface Suggestion {
  /** Identifiant stable, permet d'épingler une suggestion. */
  id: string;
  rule: RuleId;
  ruleLabel: string;
  /** Ce qu'il faut faire. */
  title: string;
  /** Pourquoi cette action apparaît maintenant. */
  reason: string;
  trackId: string | null;
  trackTitle: string | null;
  taskId?: string;
  promoTaskId?: string;
  submissionId?: string;
  href: string;
  tone: "danger" | "warn" | "info" | "ok" | "neutre";
  score: number;
}

export interface NextActionInput {
  tracks: Track[];
  tasks: TrackTask[];
  promoTasks: PromotionTask[];
  submissions: LabelSubmission[];
  labels: Label[];
  inactivityDays: number;
}

const OPEN_STATUSES = ["a_faire", "en_cours"] as const;

export function computeSuggestions(input: NextActionInput): Suggestion[] {
  const { tracks, tasks, promoTasks, submissions, labels, inactivityDays } = input;

  const activeTracks = tracks.filter((t) => !t.archived);
  const trackById = new Map(activeTracks.map((t) => [t.id, t]));
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const out: Suggestion[] = [];

  const push = (s: Omit<Suggestion, "ruleLabel" | "score"> & { bonus?: number }) => {
    const { bonus = 0, ...rest } = s;
    out.push({
      ...rest,
      ruleLabel: RULE_LABEL[rest.rule],
      score: RULE_RANK[rest.rule] * 100 + bonus,
    });
  };

  // --- Règle 1 : tâche urgente ou en retard --------------------------------
  for (const task of tasks) {
    if (!OPEN_STATUSES.includes(task.status as (typeof OPEN_STATUSES)[number])) continue;
    const track = trackById.get(task.track_id);
    if (!track) continue;

    const overdueDays = task.due_date ? (daysSince(task.due_date) ?? 0) : 0;
    const isOverdue = overdueDays > 0;
    const isDueToday = task.due_date ? daysUntil(task.due_date) === 0 : false;
    const isUrgent = task.priority === "urgente";

    if (!isOverdue && !isDueToday && !isUrgent) continue;

    push({
      id: `task:${task.id}`,
      rule: "tache_urgente",
      title: task.title,
      reason: isOverdue
        ? `En retard de ${overdueDays} jour${overdueDays > 1 ? "s" : ""} sur « ${track.title} »`
        : isDueToday
          ? `À faire aujourd'hui sur « ${track.title} »`
          : `Marquée urgente sur « ${track.title} »`,
      trackId: track.id,
      trackTitle: track.title,
      taskId: task.id,
      href: `/studio/${track.id}?onglet=taches`,
      tone: isOverdue ? "danger" : "warn",
      bonus: -Math.min(overdueDays, 60) + (isUrgent ? -10 : 0),
    });
  }

  // Tâches de promotion en retard : même règle, même urgence.
  for (const task of promoTasks) {
    if (!OPEN_STATUSES.includes(task.status as (typeof OPEN_STATUSES)[number])) continue;
    const track = trackById.get(task.track_id);
    if (!track || !task.due_date) continue;
    const overdueDays = daysSince(task.due_date) ?? 0;
    if (overdueDays <= 0) continue;

    push({
      id: `promo:${task.id}`,
      rule: "tache_urgente",
      title: task.title,
      reason: `Tâche promo en retard de ${overdueDays} jour${overdueDays > 1 ? "s" : ""} sur « ${track.title} »`,
      trackId: track.id,
      trackTitle: track.title,
      promoTaskId: task.id,
      href: `/studio/${track.id}?onglet=promotion`,
      tone: "danger",
      bonus: -Math.min(overdueDays, 60),
    });
  }

  // --- Règle 2 : relance label prévue ---------------------------------------
  for (const submission of submissions) {
    if (submission.archived || submission.responded) continue;
    const timing = submissionTiming(submission);
    if (!timing.needsFollowup) continue;

    const track = trackById.get(submission.track_id);
    const label = labelById.get(submission.label_id);
    if (!track || !label) continue;
    if (!label.allows_followup) continue;

    push({
      id: `submission:${submission.id}`,
      rule: "relance_label",
      title: `Relancer ${label.name} au sujet de « ${track.title} »`,
      reason: timing.label,
      trackId: track.id,
      trackTitle: track.title,
      submissionId: submission.id,
      href: `/labels?envoi=${submission.id}`,
      tone: timing.tone === "danger" ? "danger" : "warn",
      bonus: -(timing.followupOverdueDays ?? 0),
    });
  }

  // --- Règle 3 : tâche promo liée à une sortie proche ------------------------
  for (const task of promoTasks) {
    if (!OPEN_STATUSES.includes(task.status as (typeof OPEN_STATUSES)[number])) continue;
    const track = trackById.get(task.track_id);
    if (!track) continue;
    const untilRelease = track.release_date ? daysUntil(track.release_date) : null;
    if (untilRelease === null || untilRelease < 0 || untilRelease > 30) continue;

    const dueIn = task.due_date ? daysUntil(task.due_date) : null;
    if (dueIn !== null && dueIn > 7) continue;
    if (dueIn !== null && dueIn < 0) continue; // déjà couvert par la règle 1

    push({
      id: `promo-soon:${task.id}`,
      rule: "promo_sortie_proche",
      title: task.title,
      reason:
        untilRelease === 0
          ? `« ${track.title} » sort aujourd'hui`
          : `« ${track.title} » sort dans ${untilRelease} jour${untilRelease > 1 ? "s" : ""}`,
      trackId: track.id,
      trackTitle: track.title,
      promoTaskId: task.id,
      href: `/studio/${track.id}?onglet=promotion`,
      tone: untilRelease <= 3 ? "warn" : "info",
      bonus: untilRelease,
    });
  }

  // --- Règle 4 : track prioritaire sans activité récente ---------------------
  for (const track of activeTracks) {
    if (track.priority !== "haute" && track.priority !== "urgente") continue;
    const idle = daysSince(track.last_activity_at) ?? 0;
    if (idle < inactivityDays) continue;

    const nextTask = tasks
      .filter(
        (t) =>
          t.track_id === track.id &&
          OPEN_STATUSES.includes(t.status as (typeof OPEN_STATUSES)[number]),
      )
      .sort((a, b) => a.position - b.position)[0];

    push({
      id: `idle:${track.id}`,
      rule: "track_prioritaire_inactive",
      title: nextTask ? nextTask.title : `Reprendre « ${track.title} »`,
      reason: `Priorité ${track.priority}, aucune activité depuis ${idle} jours`,
      trackId: track.id,
      trackTitle: track.title,
      taskId: nextTask?.id,
      href: `/studio/${track.id}`,
      tone: "warn",
      bonus: -idle,
    });
  }

  // --- Règle 5 : tâche déjà commencée ---------------------------------------
  for (const task of tasks) {
    if (task.status !== "en_cours") continue;
    const track = trackById.get(task.track_id);
    if (!track) continue;

    push({
      id: `started:${task.id}`,
      rule: "tache_commencee",
      title: task.title,
      reason: `Déjà commencée sur « ${track.title} » — la terminer libère la suite`,
      trackId: track.id,
      trackTitle: track.title,
      taskId: task.id,
      href: `/studio/${track.id}?onglet=taches`,
      tone: "info",
      bonus: 0,
    });
  }

  // --- Règle 6 : track proche d'être terminée --------------------------------
  for (const track of activeTracks) {
    const trackTasks = tasks.filter((t) => t.track_id === track.id);
    if (trackTasks.length === 0) continue;
    const { production } = trackProgress(trackTasks);
    if (production.percent < 70 || production.percent >= 100) continue;

    const nextTask = trackTasks
      .filter((t) => OPEN_STATUSES.includes(t.status as (typeof OPEN_STATUSES)[number]))
      .sort((a, b) => a.position - b.position)[0];
    if (!nextTask) continue;

    push({
      id: `almost:${track.id}`,
      rule: "track_presque_finie",
      title: nextTask.title,
      reason: `« ${track.title} » est à ${production.percent} % — ${production.remaining} tâche${
        production.remaining > 1 ? "s" : ""
      } avant la fin`,
      trackId: track.id,
      trackTitle: track.title,
      taskId: nextTask.id,
      href: `/studio/${track.id}?onglet=taches`,
      tone: "ok",
      bonus: 100 - production.percent,
    });
  }

  // Déduplication : on garde la suggestion la mieux classée par tâche/track.
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.score - b.score)
    .filter((s) => {
      const key = s.taskId ?? s.promoTaskId ?? s.submissionId ?? `track:${s.trackId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
