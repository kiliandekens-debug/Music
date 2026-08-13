"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  COLUMNS,
  SUB_STEPS,
  SUB_STEP_LABEL,
  columnOf,
  stageForColumn,
  stageForSubStep,
  type ColumnId,
  type SubStep,
} from "@/lib/domain/board";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { IconButton, Menu, MenuItem, MenuLabel, MenuSeparator, cn } from "@/components/ui";
import {
  IconCheck,
  IconMore,
  IconSparks,
  IconStudio,
  IconTarget,
} from "@/components/ui/icons";
import { TrackCard, type TrackCardData } from "./track-card";
import type { Track, TrackTask } from "@/lib/types";

/** Une icône par colonne : la forme se reconnaît avant que le mot ne se lise. */
const COLUMN_ICON: Record<ColumnId, (p: { size?: number; className?: string }) => React.ReactElement> = {
  idees: IconSparks,
  en_cours: IconStudio,
  finalisation: IconTarget,
  terminees: IconCheck,
};

/**
 * Tableau de production en quatre colonnes.
 * Les colonnes tiennent sur un écran d'ordinateur standard : pas de défilement
 * horizontal. Sur mobile, on choisit une colonne et on la lit verticalement.
 */
export function Board({ tracks }: { tracks: Track[] }) {
  const { stages, labels, update, log, touchTrack } = useData();
  const {
    workspaceById,
    stageById,
    progressByTrack,
    tasksByTrack,
    promoTasksByTrack,
    submissionsByTrack,
    labelById,
  } = useDerived();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byColumn = useMemo(() => {
    const map = new Map<ColumnId, Track[]>(COLUMNS.map((c) => [c.id, [] as Track[]]));
    for (const track of tracks) {
      const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
      map.get(columnOf(stage))!.push(track);
    }
    return map;
  }, [tracks, stageById]);

  const cardData = useMemo(() => {
    const labelName = (id: string) => labelById.get(id)?.name ?? "ce label";
    const map = new Map<string, TrackCardData>();
    for (const track of tracks) {
      const submissions = submissionsByTrack.get(track.id) ?? [];
      // Le label affiché est celui qui a signé, sinon celui qui est visé.
      const signed = submissions.find((s) => s.status === "signe");
      const labelId = signed?.label_id ?? track.intended_label_id;
      map.set(track.id, {
        track,
        workspace: track.workspace_id ? workspaceById.get(track.workspace_id) : undefined,
        stage: track.stage_id ? stageById.get(track.stage_id) : undefined,
        progress: progressByTrack.get(track.id)!,
        tasks: tasksByTrack.get(track.id) ?? [],
        promoTasks: promoTasksByTrack.get(track.id) ?? [],
        submissions,
        labelName,
        labelTitle: labelId ? (labels.find((l) => l.id === labelId)?.name ?? null) : null,
      });
    }
    return map;
  }, [
    tracks,
    labels,
    workspaceById,
    stageById,
    progressByTrack,
    tasksByTrack,
    promoTasksByTrack,
    submissionsByTrack,
    labelById,
  ]);

  async function moveToColumn(track: Track, column: ColumnId) {
    const current = track.stage_id ? stageById.get(track.stage_id) : undefined;
    if (current && columnOf(current) === column) return;
    const stage = stageForColumn(column, stages, current);
    if (!stage) return;
    await update("tracks", track.id, { stage_id: stage.id });
    touchTrack(track.id);
    log({
      entity_type: "track",
      entity_id: track.id,
      track_id: track.id,
      action: "changement_etape",
      summary: `« ${track.title} » déplacée vers ${COLUMNS.find((c) => c.id === column)?.name}`,
    });
  }

  /** Décalage d'une colonne, depuis les flèches de la carte. */
  function shift(track: Track, direction: -1 | 1) {
    const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
    const index = COLUMNS.findIndex((c) => c.id === columnOf(stage));
    const target = COLUMNS[index + direction];
    if (target) void moveToColumn(track, target.id);
  }

  async function setSubStep(track: Track, subStep: SubStep) {
    const stage = stageForSubStep(subStep, stages);
    if (!stage || stage.id === track.stage_id) return;
    await update("tracks", track.id, { stage_id: stage.id });
    touchTrack(track.id);
    log({
      entity_type: "track",
      entity_id: track.id,
      track_id: track.id,
      action: "changement_etape",
      summary: `« ${track.title} » passée en ${SUB_STEP_LABEL[subStep]}`,
    });
  }

  async function toggleTask(task: TrackTask) {
    const done = task.status === "terminee";
    await update("track_tasks", task.id, {
      status: done ? "a_faire" : "terminee",
      completed_at: done ? null : new Date().toISOString(),
    });
    touchTrack(task.track_id);
  }

  const cardMenu = (track: Track) => {
    const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
    const column = columnOf(stage);
    return (
      <Menu
        trigger={(props) => (
          <IconButton label="Déplacer" className="h-7 w-7" {...props}>
            <IconMore size={15} />
          </IconButton>
        )}
      >
        <MenuLabel>Colonne</MenuLabel>
        {COLUMNS.map((c) => (
          <MenuItem
            key={c.id}
            disabled={c.id === column}
            onClick={() => void moveToColumn(track, c.id)}
          >
            {c.name}
          </MenuItem>
        ))}
        {column === "en_cours" ? (
          <>
            <MenuSeparator />
            <MenuLabel>Sous-étape</MenuLabel>
            {SUB_STEPS.map((step) => (
              <MenuItem
                key={step}
                disabled={stage?.key === step}
                onClick={() => void setSubStep(track, step)}
              >
                {SUB_STEP_LABEL[step]}
              </MenuItem>
            ))}
          </>
        ) : null}
      </Menu>
    );
  };

  /** Propriétés communes aux cartes, ordinateur comme mobile. */
  const cardProps = (track: Track) => {
    const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
    const index = COLUMNS.findIndex((c) => c.id === columnOf(stage));
    return {
      actions: cardMenu(track),
      onMove: (direction: -1 | 1) => shift(track, direction),
      canMoveBack: index > 0,
      canMoveForward: index < COLUMNS.length - 1,
      onToggleTask: (task: TrackTask) => void toggleTask(task),
    };
  };

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const track = tracks.find((t) => t.id === String(event.active.id));
    const column = event.over ? (String(event.over.id) as ColumnId) : null;
    if (track && column) void moveToColumn(track, column);
  }

  return (
    <>
      {/* Ordinateur : quatre colonnes de largeur égale, glisser-déposer actif */}
      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="hidden grid-cols-4 items-start gap-4 lg:grid">
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              id={column.id}
              name={column.name}
              tracks={byColumn.get(column.id) ?? []}
              cardData={cardData}
              cardProps={cardProps}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingId && cardData.get(draggingId) ? (
            <div className="w-[300px] rotate-1">
              <TrackCard data={cardData.get(draggingId)!} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <MobileBoard byColumn={byColumn} cardData={cardData} cardProps={cardProps} />
    </>
  );
}

/** Ce que la colonne transmet à chaque carte. */
interface CardProps {
  actions: React.ReactNode;
  onMove: (direction: -1 | 1) => void;
  canMoveBack: boolean;
  canMoveForward: boolean;
  onToggleTask: (task: TrackTask) => void;
}

function BoardColumn({
  id,
  name,
  tracks,
  cardData,
  cardProps,
}: {
  id: ColumnId;
  name: string;
  tracks: Track[];
  cardData: Map<string, TrackCardData>;
  cardProps: (track: Track) => CardProps;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const Icon = COLUMN_ICON[id];

  return (
    <section className="flex min-w-0 flex-col">
      <header className="mb-2.5 flex items-center gap-2 px-1">
        <Icon size={15} className="shrink-0 text-muted" />
        <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-soft">
          {name}
        </h2>
        {tracks.length > 0 ? (
          <span className="tabular ml-auto text-label font-semibold text-accent-ink">
            {tracks.length}
          </span>
        ) : null}
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "well min-h-28 flex-1 space-y-3 border border-transparent p-2.5 transition-colors duration-100",
          isOver && "border-accent/50 bg-accent-soft",
        )}
      >
        {tracks.map((track) => (
          <DraggableCard
            key={track.id}
            track={track}
            data={cardData.get(track.id)}
            cardProps={cardProps}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({
  track,
  data,
  cardProps,
}: {
  track: Track;
  data: TrackCardData | undefined;
  cardProps: (track: Track) => CardProps;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: track.id });
  if (!data) return null;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-40")}>
      <TrackCard data={data} {...cardProps(track)} />
    </div>
  );
}

/** Mobile : un filtre par colonne, puis une liste verticale. */
function MobileBoard({
  byColumn,
  cardData,
  cardProps,
}: {
  byColumn: Map<ColumnId, Track[]>;
  cardData: Map<string, TrackCardData>;
  cardProps: (track: Track) => CardProps;
}) {
  /*
   * On ouvre sur « En cours » quand il y a du travail en cours, sinon sur la
   * première colonne qui contient quelque chose : arriver sur une colonne vide
   * donnerait l'impression d'une application vide.
   */
  const [selected, setSelected] = useState<ColumnId>(() => {
    if ((byColumn.get("en_cours")?.length ?? 0) > 0) return "en_cours";
    return COLUMNS.find((c) => (byColumn.get(c.id)?.length ?? 0) > 0)?.id ?? "en_cours";
  });
  const tracks = byColumn.get(selected) ?? [];

  return (
    <div className="lg:hidden">
      <div className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5">
        {COLUMNS.map((column) => {
          const count = byColumn.get(column.id)?.length ?? 0;
          const active = selected === column.id;
          const Icon = COLUMN_ICON[column.id];
          return (
            <button
              key={column.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(column.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-100",
                active
                  ? "border-transparent bg-accent text-white"
                  : "border-line bg-surface text-ink-soft",
              )}
            >
              <Icon size={14} />
              {column.name}
              {count > 0 ? (
                <span className={cn("tabular", active ? "text-white/70" : "text-muted")}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {tracks.map((track) => {
          const data = cardData.get(track.id);
          return data ? <TrackCard key={track.id} data={data} {...cardProps(track)} /> : null;
        })}
        {tracks.length === 0 ? (
          <p className="py-3 text-sm text-muted">Aucune track dans cette colonne.</p>
        ) : null}
      </div>
    </div>
  );
}
