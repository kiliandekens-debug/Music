"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { accentHex } from "@/lib/constants";
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
  Meter,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  cn,
} from "@/components/ui";
import {
  IconChevronLeft,
  IconEdit,
  IconMore,
  IconNote,
  IconRelease,
  IconStudio,
  IconTag,
} from "@/components/ui/icons";
import { AudioPlayerProvider } from "@/components/audio/player";
import { TrackArtwork } from "@/components/tracks/track-artwork";
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
        <p className="flex flex-wrap items-center gap-3 text-base text-muted">
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
  const color = accentHex(workspace?.color);
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

  const words = [aliasLabel(workspace?.name), track.genre].filter(Boolean);
  const readout = [track.bpm ? `${Number(track.bpm)} BPM` : null, track.musical_key]
    .filter(Boolean)
    .join(" · ");

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
      <div className="mx-auto w-full max-w-[1080px] px-5 py-6 lg:px-10 lg:py-9">
        <Link
          href="/studio"
          className="mb-5 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <IconChevronLeft size={16} />
          Mes tracks
        </Link>

        {/*
          Bandeau d'ouverture : la pochette générative, agrandie et floutée,
          sert de fond à sa propre fiche. La track s'annonce avant de se lire.
        */}
        <header className="card relative mb-6 overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <TrackArtwork
              track={track}
              color={color}
              className="h-full w-full scale-125 opacity-60 blur-2xl"
              detailed
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/45" />
          </div>

          <div className="relative flex flex-wrap items-start gap-5 p-5 lg:p-7">
            <TrackArtwork
              track={track}
              color={color}
              className="h-24 w-24 rounded-2xl shadow-lg shadow-black/40 ring-1 ring-white/10 lg:h-28 lg:w-28"
              detailed
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-page">
                {track.title}
              </h1>
              {words.length > 0 || readout ? (
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-base text-muted">
                  {words.length > 0 ? <span>{words.join(" · ")}</span> : null}
                  {words.length > 0 && readout ? <span aria-hidden>·</span> : null}
                  {readout ? <span className="readout">{readout}</span> : null}
                </p>
              ) : null}

              {progress && progress.production.total > 0 ? (
                <div className="mt-4 flex max-w-md items-center gap-3">
                  <Meter
                    segments={22}
                    className="flex-1"
                    value={progress.production.percent}
                    color={progress.production.percent >= 100 ? "var(--color-ok)" : color}
                    label="Production"
                  />
                  <span className="readout text-sm font-medium text-ink-soft">
                    {progress.production.done} / {progress.production.total}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
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

          {/* L'étape se choisit d'un clic, pas dans une liste déroulante. */}
          <div className="relative flex flex-wrap items-center gap-1.5 border-t border-line/70 px-5 py-4 lg:px-7">
            {COLUMNS.map((c) => (
              <StepChip
                key={c.id}
                label={c.name}
                active={c.id === column}
                onClick={() => void changeColumn(c.id)}
              />
            ))}
            {column === "en_cours" ? (
              <>
                <span className="mx-1.5 h-5 w-px bg-line" aria-hidden />
                {SUB_STEPS.map((step) => (
                  <StepChip
                    key={step}
                    small
                    label={SUB_STEP_LABEL[step]}
                    active={stage?.key === step}
                    onClick={() => void changeSubStep(step)}
                  />
                ))}
              </>
            ) : null}
          </div>

          {track.is_blocked ? (
            <p className="relative border-t border-danger/20 bg-danger/[0.07] px-5 py-3 text-sm text-danger lg:px-7">
              Bloquée{track.blocked_reason ? ` : ${track.blocked_reason}` : ""}
            </p>
          ) : null}

          {nextAction ? (
            <p
              className={cn(
                "relative flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line/70 px-5 py-3.5 text-base lg:px-7",
                ACTION_TONE[nextAction.tone],
              )}
            >
              <span className="eyebrow text-muted">Ensuite</span>
              <span className="font-medium">{nextAction.text}</span>
            </p>
          ) : null}
        </header>

        <div className="space-y-3.5">
          <CollapsibleBlock
            title="Production"
            icon={<IconStudio size={16} />}
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
            icon={<IconTag size={16} />}
            summary={submissions.length > 0 ? `${submissions.length}` : undefined}
            open={open.includes("labels")}
            onToggle={() => toggleBlock("labels")}
          >
            <LabelsBlock track={track} />
          </CollapsibleBlock>

          <CollapsibleBlock
            title="Promotion"
            icon={<IconRelease size={16} />}
            open={open.includes("promotion")}
            onToggle={() => toggleBlock("promotion")}
          >
            <PromotionBlock track={track} onEdit={() => setEditing(true)} />
          </CollapsibleBlock>

          <CollapsibleBlock
            title="Notes et fichiers"
            icon={<IconNote size={16} />}
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

/** Pastille d'étape : un clic suffit, aucun menu à ouvrir. */
function StepChip({
  label,
  active,
  onClick,
  small,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border font-medium transition-colors duration-100",
        small ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        active
          ? "border-transparent bg-accent text-white"
          : "border-line bg-surface text-muted hover:text-ink-soft",
      )}
    >
      {label}
    </button>
  );
}
