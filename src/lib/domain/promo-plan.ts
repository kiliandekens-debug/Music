/**
 * Planning promotionnel à rebours depuis la date de sortie.
 * Les tâches générées sont ensuite librement modifiables, supprimables et
 * réorganisables : ce fichier ne sert qu'à la génération initiale.
 */

import { addDays, format } from "date-fns";
import { toDate } from "@/lib/format";

export interface PlanTemplateTask {
  title: string;
  offset_days: number;
  group_key: string;
  weight?: number;
}

interface PlanGroup {
  key: string;
  offset: number;
  tasks: string[];
}

const PLAN: PlanGroup[] = [
  {
    key: "J-28",
    offset: -28,
    tasks: [
      "Valider l'artwork",
      "Préparer le master final",
      "Créer le plan de communication",
      "Préparer la biographie et le texte de présentation",
    ],
  },
  {
    key: "J-21",
    offset: -21,
    tasks: [
      "Préparer le premier teaser",
      "Préparer les vidéos courtes",
      "Créer ou vérifier le smartlink",
      "Préparer la campagne de pré-save",
    ],
  },
  {
    key: "J-14",
    offset: -14,
    tasks: [
      "Publier le premier teaser",
      "Commencer les envois promotionnels",
      "Contacter les DJs, radios, playlists et médias",
      "Préparer le contenu de la semaine de sortie",
    ],
  },
  {
    key: "J-7",
    offset: -7,
    tasks: [
      "Publier un nouvel extrait",
      "Vérifier tous les liens",
      "Effectuer les premières relances",
      "Préparer la publication du jour de sortie",
    ],
  },
  {
    key: "Jour J",
    offset: 0,
    tasks: [
      "Publier l'annonce principale",
      "Mettre à jour les liens",
      "Partager les stories",
      "Vérifier la disponibilité sur les plateformes",
      "Contacter les personnes ayant soutenu la sortie",
    ],
  },
  {
    key: "J+3",
    offset: 3,
    tasks: [
      "Partager les premiers retours",
      "Publier un contenu supplémentaire",
      "Enregistrer les premiers résultats",
    ],
  },
  {
    key: "J+7",
    offset: 7,
    tasks: [
      "Effectuer une nouvelle vague de communication",
      "Partager les soutiens DJ ou playlists",
      "Analyser les premiers résultats",
    ],
  },
  {
    key: "J+14",
    offset: 14,
    tasks: [
      "Effectuer un bilan intermédiaire",
      "Ajouter les résultats",
      "Terminer ou prolonger la campagne",
    ],
  },
];

/** Checklist des assets promotionnels, indépendante du calendrier. */
export const PROMO_ASSETS: string[] = [
  "Master final",
  "Radio edit",
  "Artwork",
  "Cover carrée",
  "Story verticale",
  "Reel ou vidéo courte",
  "Teaser audio",
  "Press kit",
  "Biographie",
  "Texte de présentation",
  "Photos",
  "Smartlink",
  "Lien de pré-save",
  "Lien privé",
  "Métadonnées",
  "ISRC",
  "UPC",
  "Crédits",
  "Date de sortie",
];

export const PLAN_GROUP_KEYS = [...PLAN.map((g) => g.key), "Assets"];

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
 * Génère le planning complet (calendrier + assets) pour une date de sortie.
 * Sans date de sortie, les tâches sont créées sans échéance : le producteur
 * peut préparer une campagne avant de connaître la date exacte.
 */
export function generatePromoPlan(
  releaseDate: string | null,
  options: { includeAssets?: boolean; includeSchedule?: boolean } = {},
): GeneratedPromoTask[] {
  const { includeAssets = true, includeSchedule = true } = options;
  const release = toDate(releaseDate);
  const out: GeneratedPromoTask[] = [];
  let position = 0;

  if (includeSchedule) {
    for (const group of PLAN) {
      for (const title of group.tasks) {
        out.push({
          title,
          group_key: group.key,
          offset_days: group.offset,
          due_date: release ? format(addDays(release, group.offset), "yyyy-MM-dd") : null,
          is_asset: false,
          position: position++,
          weight: 1,
        });
      }
    }
  }

  if (includeAssets) {
    for (const title of PROMO_ASSETS) {
      out.push({
        title,
        group_key: "Assets",
        offset_days: -28,
        due_date: release ? format(addDays(release, -28), "yyyy-MM-dd") : null,
        is_asset: true,
        position: position++,
        weight: 1,
      });
    }
  }

  return out;
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

/** Ordre d'affichage des groupes du planning. */
export function groupRank(key: string): number {
  const index = PLAN_GROUP_KEYS.indexOf(key);
  return index === -1 ? PLAN_GROUP_KEYS.length : index;
}
