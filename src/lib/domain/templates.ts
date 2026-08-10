/**
 * Modèles de checklists créés à la première connexion.
 * Ils sont ensuite entièrement modifiables depuis les Paramètres : ces
 * définitions ne servent qu'à l'amorçage du compte.
 */

import type { TaskCategory } from "@/lib/types";

export interface SeedTemplateItem {
  title: string;
  phase: string;
  category?: TaskCategory;
  weight?: number;
  estimated_minutes?: number;
}

export interface SeedTemplate {
  name: string;
  description: string;
  scope: "production" | "promotion" | "mixte";
  workflow_key: string;
  items: SeedTemplateItem[];
}

const p = (title: string, phase: string, weight = 1, estimated_minutes?: number): SeedTemplateItem => ({
  title,
  phase,
  category: "production",
  weight,
  estimated_minutes,
});

const promo = (title: string, weight = 1): SeedTemplateItem => ({
  title,
  phase: "promotion",
  category: "promotion",
  weight,
});

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "Deepest Mind",
    description: "Workflow complet pour un morceau Deepest Mind.",
    scope: "production",
    workflow_key: "deepest_mind",
    items: [
      p("Poser l'intention et l'ambiance", "idee", 1, 20),
      p("Trouver la boucle principale", "idee", 2, 60),
      p("Choisir la palette sonore", "production", 2, 60),
      p("Construire le groove et la basse", "production", 3, 90),
      p("Écrire la mélodie / le lead", "production", 3, 90),
      p("Créer les nappes et textures", "production", 2, 60),
      p("Poser l'arrangement complet", "arrangement", 3, 120),
      p("Travailler les transitions et breaks", "arrangement", 2, 60),
      p("Ajouter les FX et automations", "arrangement", 2, 60),
      p("Nettoyage et gain staging", "mixage", 2, 45),
      p("Équilibrer le mix", "mixage", 3, 120),
      p("Traiter le bas du spectre", "mixage", 2, 60),
      p("Vérifier sur plusieurs systèmes d'écoute", "mixage", 2, 30),
      p("Pré-master et export", "mastering", 2, 45),
      p("Écoute finale à froid", "mastering", 1, 30),
    ],
  },
  {
    name: "ELVIK",
    description: "Workflow orienté club / énergie pour les productions ELVIK.",
    scope: "production",
    workflow_key: "elvik",
    items: [
      p("Définir l'énergie et le tempo", "idee", 1, 15),
      p("Construire le drop", "production", 3, 120),
      p("Travailler le kick et la basse", "production", 3, 90),
      p("Créer le riff principal", "production", 3, 90),
      p("Construire le build-up", "arrangement", 2, 60),
      p("Poser l'intro et l'outro DJ friendly", "arrangement", 2, 45),
      p("Arrangement complet", "arrangement", 3, 120),
      p("Sound design et FX", "arrangement", 2, 60),
      p("Mix : punch et clarté", "mixage", 3, 120),
      p("Contrôle du niveau et de la dynamique", "mixage", 2, 45),
      p("Test en conditions club", "mixage", 2, 30),
      p("Pré-master", "mastering", 2, 45),
      p("Export master + radio edit", "mastering", 1, 30),
    ],
  },
  {
    name: "Remix",
    description: "Étapes typiques d'un remix à partir de stems.",
    scope: "production",
    workflow_key: "remix",
    items: [
      p("Réceptionner et trier les stems", "idee", 1, 30),
      p("Choisir les éléments à conserver", "idee", 1, 30),
      p("Caler tempo et tonalité", "production", 2, 45),
      p("Créer la nouvelle base rythmique", "production", 3, 90),
      p("Retravailler l'harmonie", "production", 2, 60),
      p("Traiter les vocals", "production", 2, 60),
      p("Arrangement du remix", "arrangement", 3, 120),
      p("Mix", "mixage", 3, 120),
      p("Pré-master", "mastering", 2, 45),
      p("Vérifier les contraintes du label / deadline", "preparation", 1, 15),
    ],
  },
  {
    name: "Mixage",
    description: "Checklist de mixage détaillée, à ajouter sur une track existante.",
    scope: "production",
    workflow_key: "mixage",
    items: [
      p("Organiser et nommer les pistes", "mixage", 1, 20),
      p("Gain staging complet", "mixage", 2, 30),
      p("Équilibre statique des niveaux", "mixage", 2, 45),
      p("Égalisation corrective", "mixage", 3, 60),
      p("Compression et dynamique", "mixage", 2, 45),
      p("Placement stéréo et profondeur", "mixage", 2, 45),
      p("Reverbs et delays", "mixage", 2, 45),
      p("Traitement du bus master", "mixage", 2, 30),
      p("Automations de mix", "mixage", 2, 45),
      p("Écoute mono", "mixage", 1, 15),
      p("Comparaison avec les références", "mixage", 2, 30),
      p("Écoute sur casque, monitors et téléphone", "mixage", 2, 30),
      p("Export du mix daté", "mixage", 1, 10),
    ],
  },
  {
    name: "Mastering",
    description: "Préparation et finalisation du master.",
    scope: "production",
    workflow_key: "mastering",
    items: [
      p("Nettoyer le mix avant master", "mastering", 2, 30),
      p("Laisser de la marge (headroom)", "mastering", 1, 10),
      p("Égalisation large bande", "mastering", 2, 30),
      p("Compression multibande si nécessaire", "mastering", 2, 30),
      p("Traitement stéréo", "mastering", 1, 20),
      p("Limiteur et niveau final (LUFS)", "mastering", 3, 30),
      p("Contrôle du true peak", "mastering", 1, 10),
      p("Écoute complète sans intervention", "mastering", 2, 20),
      p("Export WAV 24 bits", "mastering", 1, 10),
      p("Export MP3 320 pour envoi", "mastering", 1, 10),
    ],
  },
  {
    name: "Préparation d'une sortie",
    description: "Tout ce qu'il faut réunir avant d'annoncer une sortie.",
    scope: "promotion",
    workflow_key: "preparation_sortie",
    items: [
      promo("Valider le master final avec le label", 2),
      promo("Valider l'artwork", 2),
      promo("Rédiger la biographie", 1),
      promo("Rédiger le texte de présentation", 1),
      promo("Réunir les crédits complets", 1),
      promo("Obtenir l'ISRC", 1),
      promo("Obtenir l'UPC", 1),
      promo("Vérifier les métadonnées", 2),
      promo("Fixer la date de sortie", 2),
      promo("Créer le smartlink", 1),
      promo("Créer le lien de pré-save", 1),
      promo("Préparer le press kit", 2),
    ],
  },
  {
    name: "Promotion",
    description: "Actions promotionnelles autour d'une sortie.",
    scope: "promotion",
    workflow_key: "promotion",
    items: [
      promo("Préparer le teaser audio", 2),
      promo("Tourner les vidéos courtes", 3),
      promo("Préparer les visuels story", 1),
      promo("Planifier les publications", 2),
      promo("Contacter les DJs", 2),
      promo("Contacter les radios", 2),
      promo("Contacter les playlists", 2),
      promo("Contacter les médias", 1),
      promo("Relancer les contacts sans réponse", 1),
      promo("Publier l'annonce le jour de la sortie", 3),
      promo("Partager les soutiens reçus", 1),
      promo("Enregistrer les résultats à J+7", 1),
      promo("Faire le bilan de la sortie", 2),
    ],
  },
];

/** Modèle proposé par défaut selon le type de workflow d'un espace. */
export function templateNameForWorkflow(workflowType: string | null | undefined): string | null {
  switch (workflowType) {
    case "deepest_mind":
      return "Deepest Mind";
    case "elvik":
      return "ELVIK";
    case "remix":
      return "Remix";
    default:
      return null;
  }
}
