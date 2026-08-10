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
import { accentHex } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Badge, IconButton, Menu, MenuItem, MenuLabel, cn } from "@/components/ui";
import { IconMore } from "@/components/ui/icons";
import { TrackCard, type TrackCardData } from "./track-card";
import type { Stage, Track } from "@/lib/types";

/** Tableau Kanban : glisser-déposer sur ordinateur, menu « Changer d'étape » sur mobile. */
export function Kanban({ tracks }: { tracks: Track[] }) {
  const { update, log, touchTrack, reminders } = useData();
  const { activeStages, workspaceById, stageById, progressByTrack } = useDerived();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const stage of activeStages) map.set(stage.id, []);
    const orphans: Track[] = [];
    for (const track of tracks) {
      const list = track.stage_id ? map.get(track.stage_id) : undefined;
      if (list) list.push(track);
      else orphans.push(track);
    }
    return { map, orphans };
  }, [tracks, activeStages]);

  const cardData = useMemo(() => {
    const nextReminderByTrack = new Map<string, (typeof reminders)[number]>();
    for (const reminder of [...reminders]
      .filter((r) => !r.done_at)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))) {
      if (reminder.track_id && !nextReminderByTrack.has(reminder.track_id)) {
        nextReminderByTrack.set(reminder.track_id, reminder);
      }
    }
    const map = new Map<string, TrackCardData>();
    for (const track of tracks) {
      map.set(track.id, {
        track,
        workspace: track.workspace_id ? workspaceById.get(track.workspace_id) : undefined,
        stage: track.stage_id ? stageById.get(track.stage_id) : undefined,
        progress: progressByTrack.get(track.id) ?? {
          production: {
            percent: 0,
            doneWeight: 0,
            totalWeight: 0,
            remaining: 0,
            total: 0,
            done: 0,
            blocked: 0,
          },
          promotion: {
            percent: 0,
            doneWeight: 0,
            totalWeight: 0,
            remaining: 0,
            total: 0,
            done: 0,
            blocked: 0,
          },
        },
        nextReminder: nextReminderByTrack.get(track.id),
      });
    }
    return map;
  }, [tracks, workspaceById, stageById, progressByTrack, reminders]);

  async function moveTrack(trackId: string, stageId: string) {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.stage_id === stageId) return;
    const stage = activeStages.find((s) => s.id === stageId);
    await update("tracks", trackId, { stage_id: stageId });
    touchTrack(trackId);
    log({
      entity_type: "track",
      entity_id: trackId,
      track_id: trackId,
      action: "changement_etape",
      summary: `« ${track.title} » déplacée vers ${stage?.name ?? "une autre étape"}`,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const trackId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : null;
    if (stageId) void moveTrack(trackId, stageId);
  }

  const stageMenu = (track: Track) => (
    <Menu
      trigger={(props) => (
        <IconButton label="Actions" {...props}>
          <IconMore size={16} />
        </IconButton>
      )}
    >
      <MenuLabel>Changer d&apos;étape</MenuLabel>
      {activeStages.map((stage) => (
        <MenuItem
          key={stage.id}
          onClick={() => void moveTrack(track.id, stage.id)}
          disabled={stage.id === track.stage_id}
        >
          {stage.name}
        </MenuItem>
      ))}
    </Menu>
  );

  return (
    <>
      {/* Ordinateur : colonnes horizontales avec glisser-déposer */}
      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="hidden gap-3 overflow-x-auto pb-4 lg:flex">
          {activeStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              tracks={byStage.map.get(stage.id) ?? []}
              cardData={cardData}
              actions={stageMenu}
            />
          ))}
          {byStage.orphans.length > 0 ? (
            <div className="w-[290px] shrink-0">
              <p className="mb-2 px-1 text-[12px] font-medium text-faint">Sans étape</p>
              <div className="space-y-2">
                {byStage.orphans.map((track) => {
                  const data = cardData.get(track.id);
                  return data ? (
                    <TrackCard key={track.id} data={data} actions={stageMenu(track)} />
                  ) : null;
                })}
              </div>
            </div>
          ) : null}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingId && cardData.get(draggingId) ? (
            <div className="w-[290px] rotate-1">
              <TrackCard data={cardData.get(draggingId)!} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile : une étape à la fois, en vertical */}
      <MobileKanban
        stages={activeStages}
        byStage={byStage.map}
        orphans={byStage.orphans}
        cardData={cardData}
        actions={stageMenu}
      />
    </>
  );
}

function KanbanColumn({
  stage,
  tracks,
  cardData,
  actions,
}: {
  stage: Stage;
  tracks: Track[];
  cardData: Map<string, TrackCardData>;
  actions: (track: Track) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section className="flex w-[290px] shrink-0 flex-col">
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: accentHex(stage.color) }}
            aria-hidden
          />
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            {stage.name}
          </h2>
        </div>
        <span className="tabular text-[12px] text-faint">{tracks.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-24 flex-1 space-y-2 rounded-xl border border-transparent p-1 transition-colors duration-100",
          isOver && "border-accent/40 bg-accent-soft/40",
        )}
      >
        {tracks.map((track) => (
          <DraggableCard key={track.id} track={track} data={cardData.get(track.id)} actions={actions} />
        ))}
        {tracks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-faint">Aucune track</p>
        ) : null}
      </div>
    </section>
  );
}

function DraggableCard({
  track,
  data,
  actions,
}: {
  track: Track;
  data: TrackCardData | undefined;
  actions: (track: Track) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: track.id });
  if (!data) return null;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-40")}>
      <TrackCard data={data} actions={actions(track)} />
    </div>
  );
}

function MobileKanban({
  stages,
  byStage,
  orphans,
  cardData,
  actions,
}: {
  stages: Stage[];
  byStage: Map<string, Track[]>;
  orphans: Track[];
  cardData: Map<string, TrackCardData>;
  actions: (track: Track) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string>(stages[0]?.id ?? "");
  const current = selected || stages[0]?.id || "";
  const tracks = current === "__orphans" ? orphans : (byStage.get(current) ?? []);

  return (
    <div className="lg:hidden">
      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
        {stages.map((stage) => {
          const count = byStage.get(stage.id)?.length ?? 0;
          const active = current === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelected(stage.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-100",
                active
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line text-muted",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accentHex(stage.color) }}
                aria-hidden
              />
              {stage.name}
              <span className="tabular text-faint">{count}</span>
            </button>
          );
        })}
        {orphans.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelected("__orphans")}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-[13px]",
              current === "__orphans"
                ? "border-line-strong bg-surface-2 text-ink"
                : "border-line text-muted",
            )}
          >
            Sans étape <span className="tabular text-faint">{orphans.length}</span>
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        {tracks.map((track) => {
          const data = cardData.get(track.id);
          return data ? <TrackCard key={track.id} data={data} actions={actions(track)} /> : null;
        })}
        {tracks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-[13px] text-faint">
            Aucune track à cette étape.
          </p>
        ) : null}
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-faint">
        <Badge>Astuce</Badge>
        Utilisez le menu ··· d&apos;une carte pour changer son étape.
      </p>
    </div>
  );
}
