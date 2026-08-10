/**
 * Calcul des progressions.
 *
 * Règle unique, appliquée partout :
 *   somme des poids des tâches terminées
 *   ÷ somme des poids de toutes les tâches actives  × 100
 *
 * « Active » exclut les tâches ignorées : une tâche écartée ne doit ni
 * gonfler ni pénaliser la progression.
 *
 * Production et promotion sont calculées séparément et ne se mélangent
 * jamais : une track peut être terminée musicalement à 100 % alors que sa
 * promotion n'est qu'à 35 %.
 */

import type { PromotionTask, TaskStatus, TrackTask } from "@/lib/types";

export interface ProgressResult {
  /** Pourcentage 0–100, arrondi à l'entier. */
  percent: number;
  doneWeight: number;
  totalWeight: number;
  /** Tâches actives restantes (ni terminées ni ignorées). */
  remaining: number;
  total: number;
  done: number;
  blocked: number;
}

const EMPTY: ProgressResult = {
  percent: 0,
  doneWeight: 0,
  totalWeight: 0,
  remaining: 0,
  total: 0,
  done: 0,
  blocked: 0,
};

interface WeightedTask {
  status: TaskStatus;
  weight: number;
}

export function isActive(status: TaskStatus): boolean {
  return status !== "ignoree";
}

export function computeProgress(tasks: WeightedTask[]): ProgressResult {
  const active = tasks.filter((t) => isActive(t.status));
  if (active.length === 0) return { ...EMPTY };

  let doneWeight = 0;
  let totalWeight = 0;
  let done = 0;
  let blocked = 0;

  for (const task of active) {
    const weight = Math.max(1, task.weight || 1);
    totalWeight += weight;
    if (task.status === "terminee") {
      doneWeight += weight;
      done += 1;
    }
    if (task.status === "bloquee") blocked += 1;
  }

  return {
    percent: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
    doneWeight,
    totalWeight,
    remaining: active.length - done,
    total: active.length,
    done,
    blocked,
  };
}

export interface TrackProgress {
  production: ProgressResult;
  promotion: ProgressResult;
}

/**
 * Progression d'une track.
 * La promotion agrège les tâches de promotion de la track et les tâches du
 * planning de campagne : ce sont les deux endroits où l'on coche du travail
 * promotionnel, et l'utilisateur attend une seule barre.
 */
export function trackProgress(
  tasks: TrackTask[],
  promoTasks: PromotionTask[] = [],
): TrackProgress {
  const production = computeProgress(tasks.filter((t) => t.category === "production"));
  const promotion = computeProgress([
    ...tasks.filter((t) => t.category === "promotion"),
    ...promoTasks,
  ]);
  return { production, promotion };
}

/** Progression d'une campagne seule (onglet Promotion / page Releases). */
export function campaignProgress(promoTasks: PromotionTask[]): ProgressResult {
  return computeProgress(promoTasks);
}
