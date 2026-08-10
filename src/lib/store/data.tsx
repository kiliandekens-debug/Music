"use client";

/**
 * Couche de données de l'application.
 *
 * Le jeu de données d'un producteur reste petit (quelques milliers de lignes
 * au total). On le charge donc une fois en mémoire, ce qui rend les filtres,
 * le Kanban et les analyses instantanés, et on écrit dans Supabase à chaque
 * mutation avec mise à jour optimiste et retour arrière en cas d'échec.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type {
  ActivityEntry,
  AudioVersion,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ContentItem,
  Insertable,
  Label,
  LabelSubmission,
  Profile,
  PromotionCampaign,
  PromotionContact,
  PromotionOutreach,
  PromotionTask,
  ReleaseMetric,
  Reminder,
  Stage,
  TableName,
  Tables,
  TimestampNote,
  Track,
  TrackFile,
  TrackReference,
  TrackTask,
  Updatable,
  Workspace,
  WorkSession,
} from "@/lib/types";

/** Tables chargées au démarrage, avec leur tri par défaut. */
const LOADED_TABLES: {
  table: TableName;
  order: { column: string; ascending: boolean };
  limit?: number;
}[] = [
  { table: "workspaces", order: { column: "position", ascending: true } },
  { table: "stages", order: { column: "position", ascending: true } },
  { table: "tracks", order: { column: "position", ascending: true } },
  { table: "track_tasks", order: { column: "position", ascending: true } },
  { table: "checklist_templates", order: { column: "name", ascending: true } },
  { table: "checklist_template_items", order: { column: "position", ascending: true } },
  { table: "audio_versions", order: { column: "created_at", ascending: false } },
  { table: "timestamp_notes", order: { column: "position_seconds", ascending: true } },
  { table: "track_references", order: { column: "created_at", ascending: false } },
  { table: "track_files", order: { column: "created_at", ascending: false } },
  { table: "work_sessions", order: { column: "started_at", ascending: false }, limit: 500 },
  { table: "labels", order: { column: "name", ascending: true } },
  { table: "label_submissions", order: { column: "created_at", ascending: false } },
  { table: "promotion_campaigns", order: { column: "release_date", ascending: true } },
  { table: "promotion_tasks", order: { column: "position", ascending: true } },
  { table: "promotion_contacts", order: { column: "name", ascending: true } },
  { table: "promotion_outreach", order: { column: "sent_at", ascending: false } },
  { table: "content_calendar", order: { column: "scheduled_at", ascending: true } },
  { table: "release_metrics", order: { column: "measured_on", ascending: true } },
  { table: "activity_log", order: { column: "created_at", ascending: false }, limit: 400 },
  { table: "reminders", order: { column: "due_at", ascending: true } },
];

/** Colonnes générées par PostgreSQL : jamais envoyées en écriture. */
const GENERATED_COLUMNS: Partial<Record<TableName, string[]>> = {
  label_submissions: ["responded"],
};

/**
 * Valeurs par défaut de la base, répliquées côté client.
 *
 * Une insertion optimiste affiche la ligne avant la réponse du serveur : sans
 * ces valeurs, la ligne temporaire n'aurait pas la même forme qu'une ligne
 * réelle (tableaux absents, compteurs manquants) et l'interface planterait le
 * temps de l'aller-retour. Elles doivent rester alignées sur les DEFAULT
 * déclarés dans supabase/migrations/0001_init.sql.
 */
const COLUMN_DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  workspaces: { color: "violet", workflow_type: "custom", position: 0, archived: false },
  stages: {
    color: "slate",
    position: 0,
    archived: false,
    is_released: false,
    is_sendable: false,
  },
  labels: {
    preferred_method: "email",
    genres: [],
    alias_scope: "les_deux",
    socials: {},
    allows_followup: true,
    archived: false,
  },
  tracks: {
    priority: "normale",
    is_blocked: false,
    position: 0,
    archived: false,
  },
  track_tasks: {
    category: "production",
    phase: "production",
    priority: "normale",
    weight: 1,
    status: "a_faire",
    actual_minutes: 0,
    position: 0,
    completed_at: null,
  },
  checklist_templates: { scope: "production" },
  checklist_template_items: {
    category: "production",
    phase: "production",
    weight: 1,
    position: 0,
  },
  audio_versions: { kind: "autre", version_number: 1, is_main: false },
  timestamp_notes: {
    position_seconds: 0,
    category: "autre",
    priority: "normale",
    resolved_at: null,
  },
  track_references: { kind: "lien", analyze_for: [] },
  track_files: { kind: "autre" },
  work_sessions: {
    status: "en_cours",
    duration_seconds: 0,
    task_ids: [],
    completed_task_ids: [],
    progress_gained: 0,
  },
  label_submissions: {
    method: "email",
    status: "a_contacter",
    followup_count: 0,
    archived: false,
    responded: false,
    responded_at: null,
  },
  promotion_campaigns: { status: "a_preparer" },
  promotion_tasks: {
    group_key: "J-0",
    offset_days: 0,
    status: "a_faire",
    weight: 1,
    is_asset: false,
    position: 0,
    completed_at: null,
  },
  promotion_contacts: { category: "autre", archived: false },
  promotion_outreach: { support_type: "aucun" },
  content_calendar: { platform: "instagram", status: "idee" },
  activity_log: { meta: {} },
  reminders: { kind: "autre", done_at: null },
};

/** Seule activity_log n'a pas de colonne updated_at (journal en écriture seule). */
const HAS_UPDATED_AT = new Set<TableName>(
  LOADED_TABLES.map((entry) => entry.table).filter((table) => table !== "activity_log"),
);

type Rows = Record<string, unknown[]>;

const EMPTY_ROWS: Rows = Object.fromEntries(LOADED_TABLES.map((t) => [t.table, []]));

export interface DataContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  userId: string;
  userEmail: string | null;

  profile: Profile | null;
  workspaces: Workspace[];
  stages: Stage[];
  tracks: Track[];
  tasks: TrackTask[];
  templates: ChecklistTemplate[];
  templateItems: ChecklistTemplateItem[];
  audioVersions: AudioVersion[];
  timestampNotes: TimestampNote[];
  references: TrackReference[];
  files: TrackFile[];
  sessions: WorkSession[];
  labels: Label[];
  submissions: LabelSubmission[];
  campaigns: PromotionCampaign[];
  promoTasks: PromotionTask[];
  contacts: PromotionContact[];
  outreach: PromotionOutreach[];
  content: ContentItem[];
  metrics: ReleaseMetric[];
  activity: ActivityEntry[];
  reminders: Reminder[];

  insert: <T extends TableName>(table: T, values: Insertable<T>) => Promise<Tables[T]>;
  insertMany: <T extends TableName>(table: T, rows: Insertable<T>[]) => Promise<Tables[T][]>;
  update: <T extends TableName>(table: T, id: string, patch: Updatable<T>) => Promise<void>;
  remove: <T extends TableName>(table: T, id: string) => Promise<void>;
  removeMany: <T extends TableName>(table: T, ids: string[]) => Promise<void>;

  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Marque une track comme active maintenant (dernière activité). */
  touchTrack: (trackId: string | null | undefined) => void;
  /** Journalise un évènement important dans l'historique. */
  log: (entry: {
    entity_type: string;
    action: string;
    summary: string;
    track_id?: string | null;
    entity_id?: string | null;
    meta?: Record<string, unknown>;
  }) => void;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function messageOf(error: PostgrestError | Error | unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function stripGenerated<T extends TableName>(table: T, values: Record<string, unknown>) {
  const generated = GENERATED_COLUMNS[table];
  if (!generated) return values;
  const copy = { ...values };
  for (const column of generated) delete copy[column];
  return copy;
}

export function DataProvider({
  userId,
  userEmail,
  initialProfile,
  children,
}: {
  userId: string;
  userEmail: string | null;
  initialProfile: Profile | null;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Rows>(EMPTY_ROWS);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingTouches = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = getSupabase();

    try {
      const [profileResult, ...results] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        ...LOADED_TABLES.map(({ table, order, limit }) => {
          let query = supabase
            .from(table)
            .select("*")
            .order(order.column, { ascending: order.ascending, nullsFirst: false });
          if (limit) query = query.limit(limit);
          return query;
        }),
      ]);

      if (profileResult.error) throw profileResult.error;

      let loadedProfile = profileResult.data as Profile | null;
      if (!loadedProfile) {
        // Filet de sécurité si le déclencheur d'inscription n'a pas tourné.
        const { data, error: insertError } = await supabase
          .from("profiles")
          .insert({ id: userId, email: userEmail })
          .select()
          .single();
        if (insertError) throw insertError;
        loadedProfile = data as Profile;
      }
      setProfile(loadedProfile);

      const next: Rows = {};
      results.forEach((result, index) => {
        const { table } = LOADED_TABLES[index];
        if (result.error) throw result.error;
        next[table] = (result.data ?? []) as unknown[];
      });
      setRows(next);
      setReady(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  // --- Mutations ------------------------------------------------------------

  const insertMany = useCallback(
    async <T extends TableName>(table: T, values: Insertable<T>[]): Promise<Tables[T][]> => {
      if (values.length === 0) return [];
      const now = new Date().toISOString();
      const defaults = COLUMN_DEFAULTS[table] ?? {};
      const prepared = values.map((v) => ({
        id: newId(),
        created_at: now,
        ...(HAS_UPDATED_AT.has(table) ? { updated_at: now } : {}),
        ...(table === "tracks" ? { last_activity_at: now } : {}),
        ...defaults,
        ...(v as Record<string, unknown>),
        user_id: userId,
      }));

      setRows((prev) => ({ ...prev, [table]: [...(prev[table] ?? []), ...prepared] }));

      const { data, error: insertError } = await getSupabase()
        .from(table)
        .insert(prepared.map((row) => stripGenerated(table, row)))
        .select();

      if (insertError) {
        const ids = new Set(prepared.map((r) => r.id));
        setRows((prev) => ({
          ...prev,
          [table]: (prev[table] ?? []).filter((r) => !ids.has((r as { id: string }).id)),
        }));
        toast.error(`Enregistrement impossible : ${messageOf(insertError)}`);
        throw insertError;
      }

      const saved = (data ?? []) as Tables[T][];
      const savedById = new Map(saved.map((r) => [(r as { id: string }).id, r]));
      setRows((prev) => ({
        ...prev,
        [table]: (prev[table] ?? []).map((r) => {
          const id = (r as { id: string }).id;
          return savedById.get(id) ?? r;
        }),
      }));
      return saved;
    },
    [toast, userId],
  );

  const insert = useCallback(
    async <T extends TableName>(table: T, values: Insertable<T>): Promise<Tables[T]> => {
      const [row] = await insertMany(table, [values]);
      return row;
    },
    [insertMany],
  );

  const update = useCallback(
    async <T extends TableName>(table: T, id: string, patch: Updatable<T>) => {
      let previous: unknown | undefined;
      setRows((prev) => ({
        ...prev,
        [table]: (prev[table] ?? []).map((r) => {
          if ((r as { id: string }).id !== id) return r;
          previous = r;
          return { ...(r as object), ...patch, updated_at: new Date().toISOString() };
        }),
      }));

      const { data, error: updateError } = await getSupabase()
        .from(table)
        .update(stripGenerated(table, patch as Record<string, unknown>))
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        if (previous) {
          const restore = previous;
          setRows((prev) => ({
            ...prev,
            [table]: (prev[table] ?? []).map((r) =>
              (r as { id: string }).id === id ? restore : r,
            ),
          }));
        }
        toast.error(`Modification impossible : ${messageOf(updateError)}`);
        throw updateError;
      }

      setRows((prev) => ({
        ...prev,
        [table]: (prev[table] ?? []).map((r) => ((r as { id: string }).id === id ? data : r)),
      }));
    },
    [toast],
  );

  const removeMany = useCallback(
    async <T extends TableName>(table: T, ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      let removed: unknown[] = [];
      setRows((prev) => {
        removed = (prev[table] ?? []).filter((r) => idSet.has((r as { id: string }).id));
        return {
          ...prev,
          [table]: (prev[table] ?? []).filter((r) => !idSet.has((r as { id: string }).id)),
        };
      });

      const { error: deleteError } = await getSupabase().from(table).delete().in("id", ids);
      if (deleteError) {
        setRows((prev) => ({ ...prev, [table]: [...(prev[table] ?? []), ...removed] }));
        toast.error(`Suppression impossible : ${messageOf(deleteError)}`);
        throw deleteError;
      }
    },
    [toast],
  );

  const remove = useCallback(
    async <T extends TableName>(table: T, id: string) => removeMany(table, [id]),
    [removeMany],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const previous = profile;
      setProfile((p) => (p ? { ...p, ...patch } : p));
      const { data, error: updateError } = await getSupabase()
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select()
        .single();
      if (updateError) {
        setProfile(previous);
        toast.error(`Modification impossible : ${messageOf(updateError)}`);
        throw updateError;
      }
      setProfile(data as Profile);
    },
    [profile, toast, userId],
  );

  /**
   * Met à jour last_activity_at. Regroupé : inutile d'écrire en base plus
   * d'une fois par minute et par track pendant une session de travail.
   */
  const touchTrack = useCallback(
    (trackId: string | null | undefined) => {
      if (!trackId) return;
      const last = pendingTouches.current.get(trackId) ?? 0;
      const now = Date.now();
      if (now - last < 60_000) return;
      pendingTouches.current.set(trackId, now);
      const iso = new Date(now).toISOString();
      setRows((prev) => ({
        ...prev,
        tracks: (prev.tracks ?? []).map((r) =>
          (r as Track).id === trackId ? { ...(r as Track), last_activity_at: iso } : r,
        ),
      }));
      void getSupabase()
        .from("tracks")
        .update({ last_activity_at: iso })
        .eq("id", trackId)
        .then(({ error: touchError }) => {
          if (touchError) console.warn("Mise à jour de l'activité échouée", touchError);
        });
    },
    [],
  );

  const log = useCallback<DataContextValue["log"]>(
    (entry) => {
      const row = {
        id: newId(),
        user_id: userId,
        track_id: entry.track_id ?? null,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id ?? null,
        action: entry.action,
        summary: entry.summary,
        meta: entry.meta ?? {},
        created_at: new Date().toISOString(),
      };
      setRows((prev) => ({ ...prev, activity_log: [row, ...(prev.activity_log ?? [])] }));
      void getSupabase()
        .from("activity_log")
        .insert(row)
        .then(({ error: logError }) => {
          if (logError) console.warn("Historique non enregistré", logError);
        });
    },
    [userId],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      loading,
      error,
      userId,
      userEmail,
      profile,
      workspaces: (rows.workspaces ?? []) as Workspace[],
      stages: (rows.stages ?? []) as Stage[],
      tracks: (rows.tracks ?? []) as Track[],
      tasks: (rows.track_tasks ?? []) as TrackTask[],
      templates: (rows.checklist_templates ?? []) as ChecklistTemplate[],
      templateItems: (rows.checklist_template_items ?? []) as ChecklistTemplateItem[],
      audioVersions: (rows.audio_versions ?? []) as AudioVersion[],
      timestampNotes: (rows.timestamp_notes ?? []) as TimestampNote[],
      references: (rows.track_references ?? []) as TrackReference[],
      files: (rows.track_files ?? []) as TrackFile[],
      sessions: (rows.work_sessions ?? []) as WorkSession[],
      labels: (rows.labels ?? []) as Label[],
      submissions: (rows.label_submissions ?? []) as LabelSubmission[],
      campaigns: (rows.promotion_campaigns ?? []) as PromotionCampaign[],
      promoTasks: (rows.promotion_tasks ?? []) as PromotionTask[],
      contacts: (rows.promotion_contacts ?? []) as PromotionContact[],
      outreach: (rows.promotion_outreach ?? []) as PromotionOutreach[],
      content: (rows.content_calendar ?? []) as ContentItem[],
      metrics: (rows.release_metrics ?? []) as ReleaseMetric[],
      activity: (rows.activity_log ?? []) as ActivityEntry[],
      reminders: (rows.reminders ?? []) as Reminder[],
      insert,
      insertMany,
      update,
      remove,
      removeMany,
      updateProfile,
      touchTrack,
      log,
      reload: load,
    }),
    [
      ready,
      loading,
      error,
      userId,
      userEmail,
      profile,
      rows,
      insert,
      insertMany,
      update,
      remove,
      removeMany,
      updateProfile,
      touchTrack,
      log,
      load,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData doit être utilisé à l'intérieur de DataProvider");
  return context;
}
