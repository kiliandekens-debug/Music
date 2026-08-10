-- ============================================================================
-- Atelier — schéma initial
-- Gestionnaire de cycle de vie de tracks pour producteur de musique
-- ============================================================================
-- Conventions :
--   * chaque table utilisateur porte un user_id -> auth.users(id)
--   * RLS stricte : un utilisateur ne voit et ne modifie que ses données
--   * created_at / updated_at sur toutes les tables (updated_at via trigger)
--   * cascade uniquement quand l'enfant n'a pas de sens sans le parent
--   * archivage (archived) plutôt que suppression pour les entités importantes
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text,
  display_name           text,
  accent                 text not null default 'violet',
  default_followup_days  integer not null default 10 check (default_followup_days between 0 and 365),
  inactivity_days        integer not null default 7 check (inactivity_days between 1 and 365),
  onboarding_done        boolean not null default false,
  locale                 text not null default 'fr',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces (espaces musicaux)
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  color         text not null default 'violet',
  workflow_type text not null default 'custom',
  position      integer not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists workspaces_user_idx on public.workspaces(user_id, position);

-- ---------------------------------------------------------------------------
-- stages (étapes du pipeline, personnalisables)
-- ---------------------------------------------------------------------------
create table if not exists public.stages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  name        text not null check (length(trim(name)) > 0),
  color       text not null default 'slate',
  position    integer not null default 0,
  archived    boolean not null default false,
  is_released boolean not null default false,
  is_sendable boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists stages_user_idx on public.stages(user_id, position);

-- ---------------------------------------------------------------------------
-- labels (mini-CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.labels (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  contact_name         text,
  email                text,
  email_secondary      text,
  country              text,
  website              text,
  demo_form_url        text,
  preferred_method     text not null default 'email'
                       check (preferred_method in ('email','formulaire','labelradar','soundcloud','direct','autre')),
  genres               text[] not null default '{}',
  alias_scope          text not null default 'les_deux'
                       check (alias_scope in ('deepest_mind','elvik','les_deux','autre')),
  socials              jsonb not null default '{}'::jsonb,
  typical_response_days integer,
  allows_followup      boolean not null default true,
  notes                text,
  archived             boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists labels_user_idx on public.labels(user_id, archived, name);

-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------
create table if not exists public.tracks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  workspace_id     uuid references public.workspaces(id) on delete set null,
  stage_id         uuid references public.stages(id) on delete set null,
  title            text not null check (length(trim(title)) > 0),
  genre            text,
  subgenre         text,
  bpm              numeric(6,2) check (bpm is null or (bpm > 0 and bpm < 400)),
  musical_key      text,
  priority         text not null default 'normale'
                   check (priority in ('basse','normale','haute','urgente')),
  target_date      date,
  release_date     date,
  intended_label_id uuid references public.labels(id) on delete set null,
  distributor      text,
  ableton_path     text,
  is_blocked       boolean not null default false,
  blocked_reason   text,
  notes            text,
  artwork_url      text,
  artwork_path     text,
  position         integer not null default 0,
  archived         boolean not null default false,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists tracks_user_idx on public.tracks(user_id, archived);
create index if not exists tracks_stage_idx on public.tracks(user_id, stage_id, position);
create index if not exists tracks_workspace_idx on public.tracks(user_id, workspace_id);
create index if not exists tracks_release_idx on public.tracks(user_id, release_date);
create index if not exists tracks_activity_idx on public.tracks(user_id, last_activity_at desc);

-- ---------------------------------------------------------------------------
-- track_tasks
-- ---------------------------------------------------------------------------
create table if not exists public.track_tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  track_id          uuid not null references public.tracks(id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  description       text,
  category          text not null default 'production' check (category in ('production','promotion')),
  phase             text not null default 'production',
  priority          text not null default 'normale'
                    check (priority in ('basse','normale','haute','urgente')),
  due_date          date,
  weight            integer not null default 1 check (weight between 1 and 100),
  status            text not null default 'a_faire'
                    check (status in ('a_faire','en_cours','bloquee','terminee','ignoree')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes    integer not null default 0 check (actual_minutes >= 0),
  position          integer not null default 0,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists track_tasks_track_idx on public.track_tasks(track_id, category, position);
create index if not exists track_tasks_user_status_idx on public.track_tasks(user_id, status, due_date);

-- ---------------------------------------------------------------------------
-- checklist_templates / items
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  description  text,
  scope        text not null default 'production' check (scope in ('production','promotion','mixte')),
  workflow_key text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists checklist_templates_user_idx on public.checklist_templates(user_id, name);

create table if not exists public.checklist_template_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  template_id       uuid not null references public.checklist_templates(id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  description       text,
  category          text not null default 'production' check (category in ('production','promotion')),
  phase             text not null default 'production',
  weight            integer not null default 1 check (weight between 1 and 100),
  estimated_minutes integer,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists checklist_items_template_idx on public.checklist_template_items(template_id, position);

-- ---------------------------------------------------------------------------
-- audio_versions
-- ---------------------------------------------------------------------------
create table if not exists public.audio_versions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  track_id         uuid not null references public.tracks(id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  kind             text not null default 'autre'
                   check (kind in ('demo','arrangement','premix','mix_v1','mix_v2','pre_master','master_final','radio_edit','autre')),
  version_number   integer not null default 1,
  file_path        text,
  file_name        text,
  file_size        bigint,
  mime_type        text,
  duration_seconds numeric(10,2),
  comment          text,
  is_main          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists audio_versions_track_idx on public.audio_versions(track_id, created_at desc);

-- ---------------------------------------------------------------------------
-- timestamp_notes (corrections horodatées)
-- ---------------------------------------------------------------------------
create table if not exists public.timestamp_notes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  track_id          uuid not null references public.tracks(id) on delete cascade,
  audio_version_id  uuid not null references public.audio_versions(id) on delete cascade,
  position_seconds  numeric(10,2) not null default 0 check (position_seconds >= 0),
  text              text not null check (length(trim(text)) > 0),
  category          text not null default 'autre'
                    check (category in ('arrangement','kick','bass','drums','lead','vocal','fx','mixage','mastering','autre')),
  priority          text not null default 'normale'
                    check (priority in ('basse','normale','haute','urgente')),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists timestamp_notes_version_idx on public.timestamp_notes(audio_version_id, position_seconds);
create index if not exists timestamp_notes_track_idx on public.timestamp_notes(track_id, resolved_at);

-- ---------------------------------------------------------------------------
-- track_references
-- ---------------------------------------------------------------------------
create table if not exists public.track_references (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  track_id    uuid not null references public.tracks(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  kind        text not null default 'lien'
              check (kind in ('spotify','youtube','soundcloud','audio','sample','midi','preset','document','artwork','lien','note')),
  url         text,
  file_path   text,
  file_name   text,
  description text,
  analyze_for text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists track_references_track_idx on public.track_references(track_id, created_at desc);

-- ---------------------------------------------------------------------------
-- track_files
-- ---------------------------------------------------------------------------
create table if not exists public.track_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  track_id   uuid not null references public.tracks(id) on delete cascade,
  name       text not null,
  kind       text not null default 'autre',
  file_path  text not null,
  file_size  bigint,
  mime_type  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists track_files_track_idx on public.track_files(track_id, created_at desc);

-- ---------------------------------------------------------------------------
-- work_sessions (Mode Session)
-- ---------------------------------------------------------------------------
create table if not exists public.work_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  track_id          uuid references public.tracks(id) on delete set null,
  status            text not null default 'en_cours' check (status in ('planifiee','en_cours','terminee','annulee')),
  planned_for       timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  task_ids          uuid[] not null default '{}',
  completed_task_ids uuid[] not null default '{}',
  notes             text,
  done_summary      text,
  remaining_summary text,
  blocker           text,
  next_action       text,
  progress_gained   numeric(6,2) not null default 0,
  phase             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists work_sessions_user_idx on public.work_sessions(user_id, started_at desc);
create index if not exists work_sessions_track_idx on public.work_sessions(track_id, started_at desc);

-- ---------------------------------------------------------------------------
-- label_submissions (envois aux labels)
-- ---------------------------------------------------------------------------
create table if not exists public.label_submissions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  track_id           uuid not null references public.tracks(id) on delete cascade,
  label_id           uuid not null references public.labels(id) on delete cascade,
  contact_name       text,
  email_used         text,
  sent_at            date,
  method             text not null default 'email'
                     check (method in ('email','formulaire','labelradar','soundcloud','direct','autre')),
  private_link       text,
  message            text,
  status             text not null default 'a_contacter'
                     check (status in ('a_contacter','pret_a_envoyer','envoye','en_attente','a_relancer',
                                       'reponse_recue','interesse','refuse','en_discussion','signe','sans_reponse','archive')),
  followup_due_date  date,
  last_followup_at   date,
  followup_count     integer not null default 0 check (followup_count >= 0),
  responded_at       date,
  -- « Répondu » est toujours déduit de la présence d'une date de réponse.
  responded          boolean generated always as (responded_at is not null) stored,
  response_type      text check (response_type in ('positive','negative','info','autre')),
  response_message   text,
  next_action        text,
  next_action_date   date,
  notes              text,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists submissions_user_idx on public.label_submissions(user_id, status);
create index if not exists submissions_track_idx on public.label_submissions(track_id, sent_at desc);
create index if not exists submissions_label_idx on public.label_submissions(label_id, sent_at desc);
create index if not exists submissions_followup_idx on public.label_submissions(user_id, followup_due_date)
  where responded_at is null;

-- ---------------------------------------------------------------------------
-- promotion_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  track_id        uuid not null references public.tracks(id) on delete cascade,
  release_date    date,
  label_id        uuid references public.labels(id) on delete set null,
  distributor     text,
  main_goal       text,
  budget          numeric(12,2),
  status          text not null default 'a_preparer'
                  check (status in ('a_preparer','en_preparation','prete','en_cours','sortie_aujourdhui','suivi_post_sortie','terminee')),
  target_audience text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (track_id)
);
create index if not exists campaigns_user_idx on public.promotion_campaigns(user_id, release_date);

-- ---------------------------------------------------------------------------
-- promotion_tasks (planning à rebours + assets)
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.promotion_campaigns(id) on delete cascade,
  track_id    uuid not null references public.tracks(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  description text,
  group_key   text not null default 'J-0',
  offset_days integer not null default 0,
  due_date    date,
  status      text not null default 'a_faire'
              check (status in ('a_faire','en_cours','bloquee','terminee','ignoree')),
  weight      integer not null default 1 check (weight between 1 and 100),
  is_asset    boolean not null default false,
  position    integer not null default 0,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists promotion_tasks_campaign_idx on public.promotion_tasks(campaign_id, position);
create index if not exists promotion_tasks_due_idx on public.promotion_tasks(user_id, due_date, status);

-- ---------------------------------------------------------------------------
-- promotion_contacts
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  category   text not null default 'autre'
             check (category in ('dj','radio','playlist','media','youtube','influenceur','promoteur','autre')),
  email      text,
  url        text,
  country    text,
  platform   text,
  notes      text,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promo_contacts_user_idx on public.promotion_contacts(user_id, category, name);

-- ---------------------------------------------------------------------------
-- promotion_outreach (envois promo)
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_outreach (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  contact_id    uuid not null references public.promotion_contacts(id) on delete cascade,
  track_id      uuid not null references public.tracks(id) on delete cascade,
  campaign_id   uuid references public.promotion_campaigns(id) on delete set null,
  sent_at       date,
  link_sent     text,
  responded_at  date,
  support_type  text not null default 'aucun'
                check (support_type in ('telechargement','feedback','playlist','radio','dj_support','repost','article','video','aucun','autre')),
  followup_date date,
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists promo_outreach_user_idx on public.promotion_outreach(user_id, sent_at desc);
create index if not exists promo_outreach_track_idx on public.promotion_outreach(track_id);
create index if not exists promo_outreach_contact_idx on public.promotion_outreach(contact_id);

-- ---------------------------------------------------------------------------
-- content_calendar
-- ---------------------------------------------------------------------------
create table if not exists public.content_calendar (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  track_id      uuid references public.tracks(id) on delete set null,
  campaign_id   uuid references public.promotion_campaigns(id) on delete cascade,
  platform      text not null default 'instagram'
                check (platform in ('instagram','tiktok','facebook','youtube','soundcloud','spotify','newsletter','autre')),
  title         text not null check (length(trim(title)) > 0),
  content_type  text,
  scheduled_at  timestamptz,
  status        text not null default 'idee'
                check (status in ('idee','a_preparer','pret','planifie','publie','annule')),
  media_path    text,
  caption       text,
  published_url text,
  results       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists content_user_idx on public.content_calendar(user_id, scheduled_at);
create index if not exists content_track_idx on public.content_calendar(track_id);

-- ---------------------------------------------------------------------------
-- release_metrics (saisie manuelle)
-- ---------------------------------------------------------------------------
create table if not exists public.release_metrics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  track_id          uuid not null references public.tracks(id) on delete cascade,
  campaign_id       uuid references public.promotion_campaigns(id) on delete set null,
  measured_on       date not null default current_date,
  spotify_streams   integer,
  spotify_listeners integer,
  saves             integer,
  playlist_adds     integer,
  youtube_views     integer,
  soundcloud_plays  integer,
  downloads         integer,
  sales             integer,
  reposts           integer,
  dj_supports       integer,
  radio_plays       integer,
  ad_spend          numeric(12,2),
  other_spend       numeric(12,2),
  revenue           numeric(12,2),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (track_id, measured_on)
);
create index if not exists metrics_track_idx on public.release_metrics(track_id, measured_on);

-- ---------------------------------------------------------------------------
-- activity_log (historique)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  summary     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_user_idx on public.activity_log(user_id, created_at desc);
create index if not exists activity_track_idx on public.activity_log(track_id, created_at desc);

-- ---------------------------------------------------------------------------
-- reminders (relances, rappels — jamais d'envoi automatique)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  kind        text not null default 'autre'
              check (kind in ('relance_label','tache','session','sortie','contenu','promo','autre')),
  entity_type text,
  entity_id   uuid,
  due_at      timestamptz not null,
  done_at     timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders(user_id, due_at) where done_at is null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles','workspaces','stages','labels','tracks','track_tasks','checklist_templates',
    'checklist_template_items','audio_versions','timestamp_notes','track_references','track_files',
    'work_sessions','label_submissions','promotion_campaigns','promotion_tasks','promotion_contacts',
    'promotion_outreach','content_calendar','release_metrics','reminders'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'workspaces','stages','labels','tracks','track_tasks','checklist_templates',
    'checklist_template_items','audio_versions','timestamp_notes','track_references','track_files',
    'work_sessions','label_submissions','promotion_campaigns','promotion_tasks','promotion_contacts',
    'promotion_outreach','content_calendar','release_metrics','activity_log','reminders'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "select_own" on public.%I', t);
    execute format('drop policy if exists "insert_own" on public.%I', t);
    execute format('drop policy if exists "update_own" on public.%I', t);
    execute format('drop policy if exists "delete_own" on public.%I', t);
    execute format(
      'create policy "select_own" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format(
      'create policy "insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end;
$$;

-- profiles : la clé primaire EST l'identifiant utilisateur
alter table public.profiles enable row level security;
drop policy if exists "select_own" on public.profiles;
drop policy if exists "insert_own" on public.profiles;
drop policy if exists "update_own" on public.profiles;
create policy "select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Privilèges
-- Supabase configure déjà des privilèges par défaut pour le rôle authenticated ;
-- on les rend explicites pour que la migration s'applique de la même façon quel
-- que soit le rôle qui l'exécute. La Row Level Security reste la seule barrière
-- entre deux comptes : ces droits n'ouvrent aucun accès aux données d'autrui.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage : un bucket privé, cloisonné par user_id (premier segment du chemin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media_select_own" on storage.objects;
drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_update_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;

create policy "media_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
