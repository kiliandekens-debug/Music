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
import { IconMore } from "@/components/ui/icons";
import { TrackCard, type TrackCardData } from "./track-card";
import type { Track } from "@/lib/types";

/**
 * Tableau de production en quatre colonnes.
 * Les colonnes tiennent sur un écran d'ordinateur standard : pas de défilement
 * horizontal. Sur mobile, on choisit une colonne et on la lit verticalement.
 */
export function Board({ tracks }: { tracks: Track[] }) {
  const { stages, update, log, touchTrack } = useData();
  const { workspaceById, stageById, progressByTrack, tasksByTrack, promoTasksByTrack, submissionsByTrack, labelById } =
    useDerived();
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
      map.set(track.id, {
        track,
        workspace: track.workspace_id ? workspaceById.get(track.workspace_id) : undefined,
        stage: track.stage_id ? stageById.get(track.stage_id) : undefined,
        progress: progressByTrack.get(track.id)!,
        tasks: tasksByTrack.get(track.id) ?? [],
        promoTasks: promoTasksByTrack.get(track.id) ?? [],
        submissions: submissionsByTrack.get(track.id) ?? [],
        labelName,
      });
    }
    return map;
  }, [
    tracks,
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

  const cardMenu = (track: Track) => {
    const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
    const column = columnOf(stage);
    return (
      <Menu
        trigger={(props) => (
          <IconButton label="Déplacer" className="bg-surface/80 backdrop-blur" {...props}>
            <IconMore size={16} />
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
        <div className="hidden grid-cols-4 items-start gap-3 lg:grid">
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              id={column.id}
              name={column.name}
              tracks={byColumn.get(column.id) ?? []}
              cardData={cardData}
              menu={cardMenu}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingId && cardData.get(draggingId) ? (
            <div className="w-[260px] rotate-1">
              <TrackCard data={cardData.get(draggingId)!} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <MobileBoard byColumn={byColumn} cardData={cardData} menu={cardMenu} />
    </>
  );
}

function BoardColumn({
  id,
  name,
  tracks,
  cardData,
  menu,
}: {
  id: ColumnId;
  name: string;
  tracks: Track[];
  cardData: Map<string, TrackCardData>;
  menu: (track: Track) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section className="flex min-w-0 flex-col">
      <header className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[13px] font-semibold text-ink-soft">{name}</h2>
        {tracks.length > 0 ? (
          <span className="tabular text-[12px] text-faint">{tracks.length}</span>
        ) : null}
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-32 flex-1 space-y-2.5 rounded-2xl border border-transparent bg-surface/40 p-2 transition-colors duration-100",
          isOver && "border-accent/40 bg-accent-soft/40",
        )}
      >
        {tracks.map((track) => (
          <DraggableCard key={track.id} track={track} data={cardData.get(track.id)} menu={menu} />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({
  track,
  data,
  menu,
}: {
  track: Track;
  data: TrackCardData | undefined;
  menu: (track: Track) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: track.id });
  if (!data) return null;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-40")}>
      <TrackCard data={data} actions={menu(track)} />
    </div>
  );
}

/** Mobile : un filtre par colonne, puis une liste verticale. */
function MobileBoard({
  byColumn,
  cardData,
  menu,
}: {
  byColumn: Map<ColumnId, Track[]>;
  cardData: Map<string, TrackCardData>;
  menu: (track: Track) => React.ReactNode;
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
      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
        {COLUMNS.map((column) => {
          const count = byColumn.get(column.id)?.length ?? 0;
          const active = selected === column.id;
          return (
            <button
              key={column.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(column.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-100",
                active
                  ? "border-accent/40 bg-accent-soft text-accent-ink"
                  : "border-line text-muted",
              )}
            >
              {column.name}
              {count > 0 ? <span className="tabular text-faint">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {tracks.map((track) => {
          const data = cardData.get(track.id);
          return data ? <TrackCard key={track.id} data={data} actions={menu(track)} /> : null;
        })}
        {tracks.length === 0 ? (
          <p className="py-3 text-[13px] text-muted">Aucune track dans cette colonne.</p>
        ) : null}
      </div>
    </div>
  );
}
