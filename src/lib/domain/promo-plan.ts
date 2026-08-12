/**
 * Checklist de sortie, calculée à rebours depuis la date de sortie.
 *
 * Huit étapes, dans l'ordre où on les vit : de la préparation des fichiers au
 * suivi qui suit la sortie. Les échéances J−28, J−14 ou J−7 sont dérivées de la
 * date de sortie, mais chaque tâche reste ensuite librement modifiable,
 * supprimable et réordonnable — ce fichier ne sert qu'à la génération initiale.
 */

import { addDays, format } from "date-fns";
import { toDate } from "@/lib/format";

export interface PlanStep {
  title: string;
  /** Décalage en jours par rapport à la sortie. Négatif = avant. */
  offset_days: number;
}

export const SIMPLE_PLAN: PlanStep[] = [
  { title: "Artwork prêt", offset_days: -28 },
  { title: "Master final prêt", offset_days: -28 },
  { title: "Smartlink disponible", offset_days: -21 },
  { title: "Teaser préparé", offset_days: -14 },
  { title: "Annonce publiée", offset_days: -7 },
  { title: "Promotion envoyée", offset_days: -7 },
  { title: "Publication du jour de sortie", offset_days: 0 },
  { title: "Suivi après la sortie", offset_days: 7 },
];

/** Étiquette lisible d'une échéance : « J−28 », « Jour J », « J+7 ». */
export function offsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return "Jour J";
  return offsetDays < 0 ? `J−${Math.abs(offsetDays)}` : `J+${offsetDays}`;
}

export interface GeneratedPromoTask {
  title: string;
  group_key: string;
  offset_days: number;
  due_date: string | null;
  is_asset: boolean;
  position: number;
  weight: number;
}

/**
 * Génère la checklist pour une date de sortie.
 * Sans date de sortie, les tâches sont créées sans échéance : on peut préparer
 * une sortie avant d'en connaître la date exacte.
 */
export function generatePromoPlan(releaseDate: string | null): GeneratedPromoTask[] {
  const release = toDate(releaseDate);
  return SIMPLE_PLAN.map((step, index) => ({
    title: step.title,
    group_key: offsetLabel(step.offset_days),
    offset_days: step.offset_days,
    due_date: release ? format(addDays(release, step.offset_days), "yyyy-MM-dd") : null,
    is_asset: false,
    position: index,
    weight: 1,
  }));
}

/** Recalcule les échéances quand la date de sortie change. */
export function recomputeDueDate(
  releaseDate: string | null,
  offsetDays: number,
): string | null {
  const release = toDate(releaseDate);
  if (!release) return null;
  return format(addDays(release, offsetDays), "yyyy-MM-dd");
}
