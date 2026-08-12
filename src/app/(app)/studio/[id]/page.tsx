"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useLocalState } from "@/lib/hooks";
import {
  COLUMNS,
  SUB_STEPS,
  SUB_STEP_LABEL,
  aliasLabel,
  columnOf,
  nextActionOf,
  stageForColumn,
  stageForSubStep,
  type ColumnId,
  type SubStep,
} from "@/lib/domain/board";
import {
  Button,
  CollapsibleBlock,
  ConfirmDialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  ProgressBar,
  Select,
  cn,
} from "@/components/ui";
import { IconChevronLeft, IconEdit, IconMore } from "@/components/ui/icons";
import { AudioPlayerProvider } from "@/components/audio/player";
import { TrackForm } from "@/components/tracks/track-form";
import { ProductionBlock } from "@/components/tracks/detail/production-block";
import { LabelsBlock } from "@/components/tracks/detail/labels-block";
import { PromotionBlock } from "@/components/tracks/detail/promotion-block";
import { NotesBlock } from "@/components/tracks/detail/notes-block";

type BlockId = "production" | "labels" | "promotion" | "notes";

const ACTION_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-accent-ink",
  neutre: "text-ink-soft",
};

export default function TrackDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const trackId = params.id;

  const { tracks, stages, audioVersions, update, remove, log, touchTrack } = useData();
  const {
    workspaceById,
    stageById,
    progressByTrack,
    tasksByTrack,
    promoTasksByTrack,
    submissionsByTrack,
    labelById,
  } = useDerived();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Les blocs ouverts sont mémorisés : on retrouve la fiche telle qu'on l'a laissée.
  const [open, setOpen] = useLocalState<BlockId[]>("atelier.fiche.blocs", ["production"]);

  const track = tracks.find((t) => t.id === trackId);

  const versions = useMemo(
    () => audioVersions.filter((v) => v.track_id === trackId),
    [audioVersions, trackId],
  );

  if (!track) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-8 lg:px-8">
        <p className="flex flex-wrap items-center gap-3 text-[14px] text-muted">
          Cette track est introuvable.
          <Link href="/studio">
            <Button variant="primary" size="sm">
              Retour au studio
            </Button>
          </Link>
        </p>
      </div>
    );
  }

  const workspace = track.workspace_id ? workspaceById.get(track.workspace_id) : undefined;
  const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
  const column = columnOf(stage);
  const progress = progressByTrack.get(track.id);
  const tasks = tasksByTrack.get(track.id) ?? [];
  const promoTasks = promoTasksByTrack.get(track.id) ?? [];
  const submissions = submissionsByTrack.get(track.id) ?? [];

  const nextAction = nextActionOf({
    tasks,
    promoTasks,
    submissions,
    labelName: (id) => labelById.get(id)?.name ?? "ce label",
    releaseDate: track.release_date,
  });

  const meta = [
    aliasLabel(workspace?.name),
    track.genre,
    track.bpm ? `${Number(track.bpm)} BPM` : null,
    track.musical_key,
  ].filter(Boolean);

  const toggleBlock = (id: BlockId) =>
    setOpen(open.includes(id) ? open.filter((b) => b !== id) : [...open, id]);

  async function changeColumn(next: ColumnId) {
    if (!track) return;
    const target = stageForColumn(next, stages, stage);
    if (!target || target.id === track.stage_id) return;
    await update("tracks", track.id, { stage_id: target.id });
    touchTrack(track.id);
    log({
      entity_type: "track",
      entity_id: track.id,
      track_id: track.id,
      action: "changement_etape",
      summary: `Étape : ${COLUMNS.find((c) => c.id === next)?.name}`,
    });
  }

  async function changeSubStep(next: SubStep) {
    if (!track) return;
    const target = stageForSubStep(next, stages);
    if (!target || target.id === track.stage_id) return;
    await update("tracks", track.id, { stage_id: target.id });
    touchTrack(track.id);
    log({
      entity_type: "track",
      entity_id: track.id,
      track_id: track.id,
      action: "changement_etape",
      summary: `Sous-étape : ${SUB_STEP_LABEL[next]}`,
    });
  }

  return (
    <AudioPlayerProvider versions={versions}>
      <div className="mx-auto w-full max-w-[960px] px-4 py-6 lg:px-8 lg:py-8">
        <Link
          href="/studio"
          className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"
        >
          <IconChevronLeft size={16} />
          Mes tracks
        </Link>

        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
                {track.title}
              </h1>
              {meta.length > 0 ? (
                <p className="mt-1 text-[13px] text-muted">{meta.join(" · ")}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <IconEdit size={15} />
                Modifier
              </Button>
              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={18} />
                  </IconButton>
                )}
              >
                <MenuItem
                  onClick={() =>
                    void update("tracks", track.id, {
                      is_blocked: !track.is_blocked,
                      blocked_reason: track.is_blocked ? null : track.blocked_reason,
                    })
                  }
                >
                  {track.is_blocked ? "Lever le blocage" : "Marquer comme bloquée"}
                </MenuItem>
                <MenuItem onClick={() => void update("tracks", track.id, { archived: !track.archived })}>
                  {track.archived ? "Désarchiver" : "Archiver"}
                </MenuItem>
                <MenuSeparator />
                <MenuItem destructive onClick={() => setConfirmDelete(true)}>
                  Supprimer définitivement
                </MenuItem>
              </Menu>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select
              value={column}
              onChange={(e) => void changeColumn(e.target.value as ColumnId)}
              aria-label="Étape"
              className="w-auto"
              wrapperClassName="shrink-0"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            {column === "en_cours" ? (
              <Select
                value={stage?.key ?? ""}
                onChange={(e) => void changeSubStep(e.target.value as SubStep)}
                aria-label="Sous-étape"
                className="w-auto"
                wrapperClassName="shrink-0"
              >
                {SUB_STEPS.map((step) => (
                  <option key={step} value={step}>
                    {SUB_STEP_LABEL[step]}
                  </option>
                ))}
              </Select>
            ) : null}

            {progress && progress.production.total > 0 ? (
              <ProgressBar
                className="min-w-40 flex-1"
                value={progress.production.percent}
                tone={progress.production.percent >= 100 ? "ok" : "accent"}
              />
            ) : null}
          </div>

          {track.is_blocked ? (
            <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[13px] text-danger">
              Bloquée{track.blocked_reason ? ` : ${track.blocked_reason}` : ""}
            </p>
          ) : null}

          {nextAction ? (
            <p className={cn("mt-3 text-[14px]", ACTION_TONE[nextAction.tone])}>
              Prochaine action : {nextAction.text}
            </p>
          ) : null}
        </header>

        <div className="space-y-3">
          <CollapsibleBlock
            title="Production"
            summary={
              progress && progress.production.total > 0
                ? `${progress.production.done}/${progress.production.total}`
                : undefined
            }
            open={open.includes("production")}
            onToggle={() => toggleBlock("production")}
          >
            <ProductionBlock track={track} />
          </CollapsibleBlock>

          <CollapsibleBlock
            title="Envois aux labels"
            summary={submissions.length > 0 ? `${submissions.length}` : undefined}
            open={open.includes("labels")}
            onToggle={() => toggleBlock("labels")}
          >
            <LabelsBlock track={track} />
          </CollapsibleBlock>

          <CollapsibleBlock
            title="Promotion"
            open={open.includes("promotion")}
            onToggle={() => toggleBlock("promotion")}
          >
            <PromotionBlock track={track} onEdit={() => setEditing(true)} />
          </CollapsibleBlock>

          <CollapsibleBlock
            title="Notes et fichiers"
            open={open.includes("notes")}
            onToggle={() => toggleBlock("notes")}
          >
            <NotesBlock track={track} />
          </CollapsibleBlock>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier la track" size="lg">
        <TrackForm
          track={track}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
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
              « {track.title} » sera supprimée avec ses tâches, versions, corrections, références et
              envois. Cette action est définitive.
            </p>
            <p className="mt-2 text-muted">
              Pour la retirer du tableau sans rien perdre, préférez l&apos;archivage.
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
