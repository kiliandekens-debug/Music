/**
 * Vocabulaire de l'interface (français) et options des listes déroulantes.
 *
 * Toutes les chaînes visibles vivent ici ou dans les composants ; les clés
 * stockées en base restent des identifiants stables et non traduits, ce qui
 * permettra d'ajouter d'autres langues plus tard sans migration de données.
 */

import type {
  AliasScope,
  AudioKind,
  CampaignStatus,
  ContactCategory,
  ContentStatus,
  NoteCategory,
  Platform,
  Priority,
  ReferenceKind,
  ResponseType,
  SubmissionMethod,
  SubmissionStatus,
  SupportType,
  TaskStatus,
} from "./types";

export const APP_NAME = "Atelier";
export const APP_TAGLINE = "Du premier bounce à la sortie";

/** Couleurs d'accentuation disponibles (espaces + préférence globale). */
export const ACCENTS = {
  violet: "#8b5cf6",
  indigo: "#6366f1",
  bleu: "#3b82f6",
  cyan: "#06b6d4",
  emeraude: "#10b981",
  citron: "#84cc16",
  ambre: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  fuchsia: "#d946ef",
  ardoise: "#64748b",
} as const;

export type AccentKey = keyof typeof ACCENTS;

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

export function accentHex(key: string | null | undefined): string {
  if (!key) return ACCENTS.violet;
  return ACCENTS[key as AccentKey] ?? ACCENTS.violet;
}

/** Étapes par défaut du pipeline. Personnalisables ensuite par l'utilisateur. */
export const DEFAULT_STAGES: {
  key: string;
  name: string;
  color: AccentKey;
  is_sendable?: boolean;
  is_released?: boolean;
}[] = [
  { key: "idee", name: "Idée", color: "ardoise" },
  { key: "production", name: "Production", color: "violet" },
  { key: "arrangement", name: "Arrangement", color: "indigo" },
  { key: "mixage", name: "Mixage", color: "bleu" },
  { key: "mastering", name: "Mastering", color: "cyan" },
  { key: "prete_a_envoyer", name: "Prête à envoyer", color: "emeraude", is_sendable: true },
  { key: "envoyee", name: "Envoyée aux labels", color: "citron", is_sendable: true },
  { key: "signee", name: "Signée / planifiée", color: "ambre" },
  { key: "sortie", name: "Sortie", color: "orange", is_released: true },
  { key: "archivee", name: "Archivée", color: "ardoise" },
];

/** Espaces musicaux proposés à la première connexion. */
export const DEFAULT_WORKSPACES: { name: string; color: AccentKey; workflow_type: string }[] = [
  { name: "Deepest Mind", color: "violet", workflow_type: "deepest_mind" },
  { name: "ELVIK", color: "cyan", workflow_type: "elvik" },
  { name: "Remixes", color: "ambre", workflow_type: "remix" },
  { name: "Idées à trier", color: "ardoise", workflow_type: "idees" },
];

// --- Libellés ---------------------------------------------------------------

export const PRIORITY_LABEL: Record<Priority, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgente: 0,
  haute: 1,
  normale: 2,
  basse: 3,
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  basse: "text-faint",
  normale: "text-muted",
  haute: "text-warn",
  urgente: "text-danger",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  bloquee: "Bloquée",
  terminee: "Terminée",
  ignoree: "Ignorée",
};

export const AUDIO_KIND_LABEL: Record<AudioKind, string> = {
  demo: "Démo",
  arrangement: "Arrangement",
  premix: "Premix",
  mix_v1: "Mix V1",
  mix_v2: "Mix V2",
  pre_master: "Pre-master",
  master_final: "Master final",
  radio_edit: "Radio edit",
  autre: "Autre",
};

export const NOTE_CATEGORY_LABEL: Record<NoteCategory, string> = {
  arrangement: "Arrangement",
  kick: "Kick",
  bass: "Bass",
  drums: "Drums",
  lead: "Lead",
  vocal: "Vocal",
  fx: "FX",
  mixage: "Mixage",
  mastering: "Mastering",
  autre: "Autre",
};

export const REFERENCE_KIND_LABEL: Record<ReferenceKind, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  audio: "Fichier audio",
  sample: "Sample",
  midi: "Fichier MIDI",
  preset: "Preset",
  document: "Document",
  artwork: "Artwork",
  lien: "Lien externe",
  note: "Note libre",
};

export const ANALYZE_FOR_OPTIONS = [
  "kick",
  "bass",
  "ambiance",
  "arrangement",
  "mixage",
  "mastering",
] as const;

export const ANALYZE_FOR_LABEL: Record<string, string> = {
  kick: "Kick",
  bass: "Bass",
  ambiance: "Ambiance",
  arrangement: "Arrangement",
  mixage: "Mixage",
  mastering: "Mastering",
};

export const SUBMISSION_METHOD_LABEL: Record<SubmissionMethod, string> = {
  email: "E-mail",
  formulaire: "Formulaire",
  labelradar: "LabelRadar",
  soundcloud: "SoundCloud privé",
  direct: "Contact direct",
  autre: "Autre",
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  a_contacter: "À contacter",
  pret_a_envoyer: "Prêt à envoyer",
  envoye: "Envoyé",
  en_attente: "En attente",
  a_relancer: "À relancer",
  reponse_recue: "Réponse reçue",
  interesse: "Intéressé",
  refuse: "Refusé",
  en_discussion: "En discussion",
  signe: "Signé",
  sans_reponse: "Sans réponse",
  archive: "Archivé",
};

/** Teinte d'affichage par statut d'envoi. */
export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, "neutre" | "info" | "ok" | "warn" | "danger"> = {
  a_contacter: "neutre",
  pret_a_envoyer: "neutre",
  envoye: "info",
  en_attente: "info",
  a_relancer: "warn",
  reponse_recue: "ok",
  interesse: "ok",
  refuse: "danger",
  en_discussion: "ok",
  signe: "ok",
  sans_reponse: "neutre",
  archive: "neutre",
};

export const RESPONSE_TYPE_LABEL: Record<ResponseType, string> = {
  positive: "Positive",
  negative: "Négative",
  info: "Demande d'informations",
  autre: "Autre",
};

export const ALIAS_SCOPE_LABEL: Record<AliasScope, string> = {
  deepest_mind: "Deepest Mind",
  elvik: "ELVIK",
  les_deux: "Les deux",
  autre: "Autre",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  a_preparer: "À préparer",
  en_preparation: "En préparation",
  prete: "Prête",
  en_cours: "En cours",
  sortie_aujourdhui: "Sortie aujourd'hui",
  suivi_post_sortie: "Suivi post-sortie",
  terminee: "Terminée",
};

export const CONTACT_CATEGORY_LABEL: Record<ContactCategory, string> = {
  dj: "DJ",
  radio: "Radio",
  playlist: "Playlist",
  media: "Média",
  youtube: "Chaîne YouTube",
  influenceur: "Influenceur",
  promoteur: "Promoteur",
  autre: "Autre",
};

export const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  telechargement: "Téléchargement",
  feedback: "Feedback",
  playlist: "Playlist",
  radio: "Diffusion radio",
  dj_support: "DJ support",
  repost: "Repost",
  article: "Article",
  video: "Vidéo",
  aucun: "Aucun",
  autre: "Autre",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  newsletter: "Newsletter",
  autre: "Autre",
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idee: "Idée",
  a_preparer: "À préparer",
  pret: "Prêt",
  planifie: "Planifié",
  publie: "Publié",
  annule: "Annulé",
};

export const CONTENT_TYPE_OPTIONS = [
  "Reel",
  "Story",
  "Post",
  "Vidéo courte",
  "Vidéo longue",
  "Teaser audio",
  "Live",
  "Newsletter",
  "Autre",
];

/** Tonalités musicales, notation courante en production. */
export const MUSICAL_KEYS = [
  "C maj", "C min", "C# maj", "C# min", "D maj", "D min", "D# maj", "D# min",
  "E maj", "E min", "F maj", "F min", "F# maj", "F# min", "G maj", "G min",
  "G# maj", "G# min", "A maj", "A min", "A# maj", "A# min", "B maj", "B min",
];

export const PHASES = [
  "idee",
  "production",
  "arrangement",
  "mixage",
  "mastering",
  "preparation",
  "promotion",
] as const;

export const PHASE_LABEL: Record<string, string> = {
  idee: "Idée",
  production: "Production",
  arrangement: "Arrangement",
  mixage: "Mixage",
  mastering: "Mastering",
  preparation: "Préparation sortie",
  promotion: "Promotion",
};

/** Extensions audio acceptées pour les versions. */
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac";

/** Seuil au-delà duquel un WAV déclenche un avertissement de stockage. */
export const LARGE_FILE_WARNING_BYTES = 40 * 1024 * 1024;

/** Raccourcis proposés pour la date de relance. */
export const FOLLOWUP_PRESETS = [7, 10, 14] as const;
