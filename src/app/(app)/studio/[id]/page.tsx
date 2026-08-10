"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PRIORITY_LABEL, accentHex } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  ProgressBar,
  Select,
  Tabs,
} from "@/components/ui";
import { IconChevronLeft, IconMore, IconSession } from "@/components/ui/icons";
import { AudioPlayerProvider } from "@/components/audio/player";
import { TrackForm } from "@/components/tracks/track-form";
import { SessionStarter } from "@/components/sessions/session-starter";
import { OverviewTab } from "@/components/tracks/detail/overview-tab";
import { TasksTab } from "@/components/tracks/detail/tasks-tab";
import { VersionsTab } from "@/components/tracks/detail/versions-tab";
import { CorrectionsTab } from "@/components/tracks/detail/corrections-tab";
import { ReferencesTab } from "@/components/tracks/detail/references-tab";
import { LabelsTab } from "@/components/tracks/detail/labels-tab";
import { PromotionTab } from "@/components/tracks/detail/promotion-tab";
import { SessionsTab } from "@/components/tracks/detail/sessions-tab";
import { HistoryTab } from "@/components/tracks/detail/history-tab";

const TAB_IDS = [
  "vue",
  "taches",
  "versions",
  "corrections",
  "references",
  "labels",
  "promotion",
  "sessions",
  "historique",
] as const;

export default function TrackDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const trackId = params.id;

  const {
    tracks,
    tasks,
    audioVersions,
    timestampNotes,
    references,
    submissions,
    sessions,
    promoTasks,
    activity,
    update,
    remove,
    log,
  } = useData();
  const { workspaceById, stageById, activeStages, progressByTrack } = useDerived();

  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  const track = tracks.find((t) => t.id === trackId);

  const counts = useMemo(
    () => ({
      taches: tasks.filter((t) => t.track_id === trackId && t.status !== "terminee" && t.status !== "ignoree").length,
      versions: audioVersions.filter((v) => v.track_id === trackId).length,
      corrections: timestampNotes.filter((n) => n.track_id === trackId && !n.resolved_at).length,
      references: references.filter((r) => r.track_id === trackId).length,
      labels: submissions.filter((s) => s.track_id === trackId).length,
      promotion: promoTasks.filter(
        (t) => t.track_id === trackId && t.status !== "terminee" && t.status !== "ignoree",
      ).length,
      sessions: sessions.filter((s) => s.track_id === trackId && s.status === "terminee").length,
    }),
    [tasks, audioVersions, timestampNotes, references, submissions, promoTasks, sessions, trackId],
  );

  const versions = useMemo(
    () => audioVersions.filter((v) => v.track_id === trackId),
    [audioVersions, trackId],
  );

  if (!track) {
    return (
      <div className="px-4 py-10 lg:px-6">
        <EmptyState
          title="Track introuvable"
          description="Elle a peut-être été supprimée."
          action={
            <Link href="/studio">
              <Button variant="primary">Retour au studio</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const requested = search.get("onglet");
  const activeTab = (TAB_IDS as readonly string[]).includes(requested ?? "")
    ? (requested as string)
    : "vue";

  const workspace = track.workspace_id ? workspaceById.get(track.workspace_id) : undefined;
  const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
  const progress = progressByTrack.get(track.id);

  function setTab(tab: string) {
    const next = new URLSearchParams(search.toString());
    next.set("onglet", tab);
    router.replace(`/studio/${trackId}?${next.toString()}`, { scroll: false });
  }

  async function changeStage(stageId: string) {
    if (!track) return;
    const target = activeStages.find((s) => s.id === stageId);
    await update("tracks", track.id, { stage_id: stageId || null });
    log({
      entity_type: "track",
      entity_id: track.id,
      track_id: track.id,
      action: "changement_etape",
      summary: `Étape changée pour ${target?.name ?? "aucune"}`,
    });
  }

  async function toggleBlocked() {
    if (!track) return;
    if (track.is_blocked) {
      await update("tracks", track.id, { is_blocked: false, blocked_reason: null });
      log({
        entity_type: "track",
        entity_id: track.id,
        track_id: track.id,
        action: "deblocage",
        summary: "Blocage levé",
      });
    } else {
      setBlockReason("");
      setBlockOpen(true);
    }
  }

  return (
    <AudioPlayerProvider versions={versions}>
      <div className="px-4 py-5 lg:px-6">
        <Link
          href="/studio"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"
        >
          <IconChevronLeft size={16} />
          Studio
        </Link>

        <header className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {workspace ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentHex(workspace.color) }}
                    aria-hidden
                  />
                ) : null}
                <h1 className="truncate text-xl font-semibold tracking-tight">{track.title}</h1>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {[
                  workspace?.name,
                  track.genre,
                  track.bpm ? `${Number(track.bpm)} BPM` : null,
                  track.musical_key,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Aucune information générale"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={track.stage_id ?? ""}
                onChange={(e) => void changeStage(e.target.value)}
                aria-label="Étape"
                className="w-auto min-w-40"
              >
                <option value="">Aucune étape</option>
                {activeStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>

              <Button variant="primary" size="sm" onClick={() => setStarting(true)}>
                <IconSession size={16} />
                Session
              </Button>

              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={18} />
                  </IconButton>
                )}
              >
                <MenuItem onClick={() => setEditing(true)}>Modifier les informations</MenuItem>
                <MenuItem onClick={() => void toggleBlocked()}>
                  {track.is_blocked ? "Lever le blocage" : "Marquer comme bloquée"}
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Priorité</MenuLabel>
                {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((p) => (
                  <MenuItem
                    key={p}
                    disabled={track.priority === p}
                    onClick={() => void update("tracks", track.id, { priority: p })}
                  >
                    {PRIORITY_LABEL[p]}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem
                  onClick={() => void update("tracks", track.id, { archived: !track.archived })}
                >
                  {track.archived ? "Désarchiver" : "Archiver"}
                </MenuItem>
                <MenuItem destructive onClick={() => setConfirmDelete(true)}>
                  Supprimer définitivement
                </MenuItem>
              </Menu>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {stage ? <Badge dot={accentHex(stage.color)}>{stage.name}</Badge> : null}
            <Badge
              tone={
                track.priority === "urgente"
                  ? "danger"
                  : track.priority === "haute"
                    ? "warn"
                    : "neutre"
              }
            >
              Priorité {PRIORITY_LABEL[track.priority].toLowerCase()}
            </Badge>
            {track.is_blocked ? <Badge tone="danger">Bloquée</Badge> : null}
            {track.archived ? <Badge>Archivée</Badge> : null}
          </div>

          {progress ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ProgressBar
                value={progress.production.percent}
                label={`Production · ${progress.production.done}/${progress.production.total} tâches`}
                tone={progress.production.percent >= 100 ? "ok" : "accent"}
              />
              <ProgressBar
                value={progress.promotion.percent}
                label={`Promotion · ${progress.promotion.done}/${progress.promotion.total} tâches`}
                tone="info"
              />
            </div>
          ) : null}
        </header>

        <Tabs
          active={activeTab}
          onChange={setTab}
          className="mb-4"
          tabs={[
            { id: "vue", label: "Vue générale" },
            { id: "taches", label: "Tâches", count: counts.taches },
            { id: "versions", label: "Versions audio", count: counts.versions },
            { id: "corrections", label: "Corrections", count: counts.corrections },
            { id: "references", label: "Références", count: counts.references },
            { id: "labels", label: "Labels", count: counts.labels },
            { id: "promotion", label: "Promotion", count: counts.promotion },
            { id: "sessions", label: "Sessions", count: counts.sessions },
            { id: "historique", label: "Notes et historique" },
          ]}
        />

        <div className="pb-6">
          {activeTab === "vue" ? <OverviewTab track={track} onEdit={() => setEditing(true)} /> : null}
          {activeTab === "taches" ? <TasksTab track={track} /> : null}
          {activeTab === "versions" ? <VersionsTab track={track} /> : null}
          {activeTab === "corrections" ? <CorrectionsTab track={track} /> : null}
          {activeTab === "references" ? <ReferencesTab track={track} /> : null}
          {activeTab === "labels" ? <LabelsTab track={track} /> : null}
          {activeTab === "promotion" ? <PromotionTab track={track} /> : null}
          {activeTab === "sessions" ? <SessionsTab track={track} /> : null}
          {activeTab === "historique" ? (
            <HistoryTab
              track={track}
              entries={activity.filter((a) => a.track_id === track.id)}
            />
          ) : null}
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Informations générales"
        size="lg"
      >
        <TrackForm track={track} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Modal>

      <Modal open={starting} onClose={() => setStarting(false)} title="Démarrer une session">
        <SessionStarter
          defaultTrackId={track.id}
          onStarted={() => {
            setStarting(false);
            router.push("/sessions/mode");
          }}
          onCancel={() => setStarting(false)}
        />
      </Modal>

      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Marquer comme bloquée"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void update("tracks", track.id, {
                  is_blocked: true,
                  blocked_reason: blockReason.trim() || null,
                });
                log({
                  entity_type: "track",
                  entity_id: track.id,
                  track_id: track.id,
                  action: "blocage",
                  summary: `Bloquée : ${blockReason.trim() || "raison non précisée"}`,
                });
                setBlockOpen(false);
              }}
            >
              Marquer comme bloquée
            </Button>
          </>
        }
      >
        <label className="text-[12px] font-medium uppercase tracking-wide text-muted">
          Raison du blocage
        </label>
        <textarea
          autoFocus
          rows={3}
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="Ce qui empêche d'avancer"
          className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer cette track ?"
        destructive
        confirmLabel="Supprimer"
        message={
          <>
            <p>
              « {track.title} » sera supprimée avec ses tâches, versions, corrections, références,
              envois et résultats. Cette action est définitive.
            </p>
            <p className="mt-2 text-muted">
              Pour la retirer du pipeline sans rien perdre, préférez l&apos;archivage.
            </p>
          </>
        }
        onConfirm={() => {
          void remove("tracks", track.id).then(() => router.push("/studio"));
        }}
      />
    </AudioPlayerProvider>
  );
}
