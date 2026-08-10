/**
 * Types de la base de données.
 * Écrits à la main et alignés sur supabase/migrations/0001_init.sql.
 */

export type Uuid = string;
export type IsoDate = string; // "2026-08-10"
export type IsoDateTime = string; // "2026-08-10T14:30:00.000Z"

export type Priority = "basse" | "normale" | "haute" | "urgente";
export type TaskStatus = "a_faire" | "en_cours" | "bloquee" | "terminee" | "ignoree";
export type TaskCategory = "production" | "promotion";

export type SubmissionMethod =
  | "email"
  | "formulaire"
  | "labelradar"
  | "soundcloud"
  | "direct"
  | "autre";

export type SubmissionStatus =
  | "a_contacter"
  | "pret_a_envoyer"
  | "envoye"
  | "en_attente"
  | "a_relancer"
  | "reponse_recue"
  | "interesse"
  | "refuse"
  | "en_discussion"
  | "signe"
  | "sans_reponse"
  | "archive";

export type ResponseType = "positive" | "negative" | "info" | "autre";

export type AudioKind =
  | "demo"
  | "arrangement"
  | "premix"
  | "mix_v1"
  | "mix_v2"
  | "pre_master"
  | "master_final"
  | "radio_edit"
  | "autre";

export type NoteCategory =
  | "arrangement"
  | "kick"
  | "bass"
  | "drums"
  | "lead"
  | "vocal"
  | "fx"
  | "mixage"
  | "mastering"
  | "autre";

export type ReferenceKind =
  | "spotify"
  | "youtube"
  | "soundcloud"
  | "audio"
  | "sample"
  | "midi"
  | "preset"
  | "document"
  | "artwork"
  | "lien"
  | "note";

export type CampaignStatus =
  | "a_preparer"
  | "en_preparation"
  | "prete"
  | "en_cours"
  | "sortie_aujourdhui"
  | "suivi_post_sortie"
  | "terminee";

export type ContactCategory =
  | "dj"
  | "radio"
  | "playlist"
  | "media"
  | "youtube"
  | "influenceur"
  | "promoteur"
  | "autre";

export type SupportType =
  | "telechargement"
  | "feedback"
  | "playlist"
  | "radio"
  | "dj_support"
  | "repost"
  | "article"
  | "video"
  | "aucun"
  | "autre";

export type Platform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "soundcloud"
  | "spotify"
  | "newsletter"
  | "autre";

export type ContentStatus = "idee" | "a_preparer" | "pret" | "planifie" | "publie" | "annule";

export type SessionStatus = "planifiee" | "en_cours" | "terminee" | "annulee";

export type AliasScope = "deepest_mind" | "elvik" | "les_deux" | "autre";

export type ReminderKind =
  | "relance_label"
  | "tache"
  | "session"
  | "sortie"
  | "contenu"
  | "promo"
  | "autre";

// ---------------------------------------------------------------------------

export interface Profile {
  id: Uuid;
  email: string | null;
  display_name: string | null;
  accent: string;
  default_followup_days: number;
  inactivity_days: number;
  onboarding_done: boolean;
  locale: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Workspace {
  id: Uuid;
  user_id: Uuid;
  name: string;
  color: string;
  workflow_type: string;
  position: number;
  archived: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Stage {
  id: Uuid;
  user_id: Uuid;
  key: string;
  name: string;
  color: string;
  position: number;
  archived: boolean;
  is_released: boolean;
  is_sendable: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Track {
  id: Uuid;
  user_id: Uuid;
  workspace_id: Uuid | null;
  stage_id: Uuid | null;
  title: string;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  musical_key: string | null;
  priority: Priority;
  target_date: IsoDate | null;
  release_date: IsoDate | null;
  intended_label_id: Uuid | null;
  distributor: string | null;
  ableton_path: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  notes: string | null;
  artwork_url: string | null;
  artwork_path: string | null;
  position: number;
  archived: boolean;
  last_activity_at: IsoDateTime;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TrackTask {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  title: string;
  description: string | null;
  category: TaskCategory;
  phase: string;
  priority: Priority;
  due_date: IsoDate | null;
  weight: number;
  status: TaskStatus;
  estimated_minutes: number | null;
  actual_minutes: number;
  position: number;
  completed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ChecklistTemplate {
  id: Uuid;
  user_id: Uuid;
  name: string;
  description: string | null;
  scope: "production" | "promotion" | "mixte";
  workflow_key: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ChecklistTemplateItem {
  id: Uuid;
  user_id: Uuid;
  template_id: Uuid;
  title: string;
  description: string | null;
  category: TaskCategory;
  phase: string;
  weight: number;
  estimated_minutes: number | null;
  position: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AudioVersion {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  name: string;
  kind: AudioKind;
  version_number: number;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  comment: string | null;
  is_main: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TimestampNote {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  audio_version_id: Uuid;
  position_seconds: number;
  text: string;
  category: NoteCategory;
  priority: Priority;
  resolved_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TrackReference {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  title: string;
  kind: ReferenceKind;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  description: string | null;
  analyze_for: string[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TrackFile {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  name: string;
  kind: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface WorkSession {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid | null;
  status: SessionStatus;
  planned_for: IsoDateTime | null;
  started_at: IsoDateTime | null;
  ended_at: IsoDateTime | null;
  duration_seconds: number;
  task_ids: Uuid[];
  completed_task_ids: Uuid[];
  notes: string | null;
  done_summary: string | null;
  remaining_summary: string | null;
  blocker: string | null;
  next_action: string | null;
  progress_gained: number;
  phase: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Label {
  id: Uuid;
  user_id: Uuid;
  name: string;
  contact_name: string | null;
  email: string | null;
  email_secondary: string | null;
  country: string | null;
  website: string | null;
  demo_form_url: string | null;
  preferred_method: SubmissionMethod;
  genres: string[];
  alias_scope: AliasScope;
  socials: Record<string, string>;
  typical_response_days: number | null;
  allows_followup: boolean;
  notes: string | null;
  archived: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface LabelSubmission {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  label_id: Uuid;
  contact_name: string | null;
  email_used: string | null;
  sent_at: IsoDate | null;
  method: SubmissionMethod;
  private_link: string | null;
  message: string | null;
  status: SubmissionStatus;
  followup_due_date: IsoDate | null;
  last_followup_at: IsoDate | null;
  followup_count: number;
  responded_at: IsoDate | null;
  /** Colonne générée : responded_at is not null. Jamais écrite directement. */
  responded: boolean;
  response_type: ResponseType | null;
  response_message: string | null;
  next_action: string | null;
  next_action_date: IsoDate | null;
  notes: string | null;
  archived: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PromotionCampaign {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  release_date: IsoDate | null;
  label_id: Uuid | null;
  distributor: string | null;
  main_goal: string | null;
  budget: number | null;
  status: CampaignStatus;
  target_audience: string | null;
  notes: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PromotionTask {
  id: Uuid;
  user_id: Uuid;
  campaign_id: Uuid;
  track_id: Uuid;
  title: string;
  description: string | null;
  group_key: string;
  offset_days: number;
  due_date: IsoDate | null;
  status: TaskStatus;
  weight: number;
  is_asset: boolean;
  position: number;
  completed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PromotionContact {
  id: Uuid;
  user_id: Uuid;
  name: string;
  category: ContactCategory;
  email: string | null;
  url: string | null;
  country: string | null;
  platform: string | null;
  notes: string | null;
  archived: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PromotionOutreach {
  id: Uuid;
  user_id: Uuid;
  contact_id: Uuid;
  track_id: Uuid;
  campaign_id: Uuid | null;
  sent_at: IsoDate | null;
  link_sent: string | null;
  responded_at: IsoDate | null;
  support_type: SupportType;
  followup_date: IsoDate | null;
  comment: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ContentItem {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid | null;
  campaign_id: Uuid | null;
  platform: Platform;
  title: string;
  content_type: string | null;
  scheduled_at: IsoDateTime | null;
  status: ContentStatus;
  media_path: string | null;
  caption: string | null;
  published_url: string | null;
  results: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ReleaseMetric {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid;
  campaign_id: Uuid | null;
  measured_on: IsoDate;
  spotify_streams: number | null;
  spotify_listeners: number | null;
  saves: number | null;
  playlist_adds: number | null;
  youtube_views: number | null;
  soundcloud_plays: number | null;
  downloads: number | null;
  sales: number | null;
  reposts: number | null;
  dj_supports: number | null;
  radio_plays: number | null;
  ad_spend: number | null;
  other_spend: number | null;
  revenue: number | null;
  notes: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ActivityEntry {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid | null;
  entity_type: string;
  entity_id: Uuid | null;
  action: string;
  summary: string;
  meta: Record<string, unknown>;
  created_at: IsoDateTime;
}

export interface Reminder {
  id: Uuid;
  user_id: Uuid;
  track_id: Uuid | null;
  title: string;
  kind: ReminderKind;
  entity_type: string | null;
  entity_id: Uuid | null;
  due_at: IsoDateTime;
  done_at: IsoDateTime | null;
  notes: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Nom de table -> type de ligne. Sert de contrat pour le store et les mutations. */
export interface Tables {
  profiles: Profile;
  workspaces: Workspace;
  stages: Stage;
  tracks: Track;
  track_tasks: TrackTask;
  checklist_templates: ChecklistTemplate;
  checklist_template_items: ChecklistTemplateItem;
  audio_versions: AudioVersion;
  timestamp_notes: TimestampNote;
  track_references: TrackReference;
  track_files: TrackFile;
  work_sessions: WorkSession;
  labels: Label;
  label_submissions: LabelSubmission;
  promotion_campaigns: PromotionCampaign;
  promotion_tasks: PromotionTask;
  promotion_contacts: PromotionContact;
  promotion_outreach: PromotionOutreach;
  content_calendar: ContentItem;
  release_metrics: ReleaseMetric;
  activity_log: ActivityEntry;
  reminders: Reminder;
}

export type TableName = keyof Tables;

/** Champs jamais fournis par le client lors d'une insertion. */
export type Insertable<T extends TableName> = Partial<Tables[T]> & { user_id?: Uuid };
export type Updatable<T extends TableName> = Partial<Tables[T]>;
