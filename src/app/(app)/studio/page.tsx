"use client";

import { useMemo, useState } from "react";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/constants";
import { useDebounced, useLocalState, useProgressiveList } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { Button, EmptyState, SearchInput, SegmentedControl, Select, cn } from "@/components/ui";
import { IconGrid, IconList, IconMusic, IconPlus } from "@/components/ui/icons";
import { Kanban } from "@/components/tracks/kanban";
import { TrackCard } from "@/components/tracks/track-card";
import type { Priority } from "@/lib/types";

type ViewMode = "kanban" | "liste";
type SortKey = "activite" | "priorite" | "titre" | "cible" | "progression";

export default function StudioPage() {
  const { tracks, reminders } = useData();
  const { visibleTracks, activeStages, workspaceById, stageById, progressByTrack } = useDerived();
  const { openQuickAdd } = useUi();

  const [view, setView] = useLocalState<ViewMode>("atelier.studio.vue", "kanban");
  const [sort, setSort] = useLocalState<SortKey>("atelier.studio.tri", "activite");
  const [stageFilter, setStageFilter] = useLocalState<string>("atelier.studio.etape", "toutes");
  const [priorityFilter, setPriorityFilter] = useLocalState<string>(
    "atelier.studio.priorite",
    "toutes",
  );
  const [onlyBlocked, setOnlyBlocked] = useLocalState<boolean>("atelier.studio.bloquees", false);
  const [showArchived, setShowArchived] = useLocalState<boolean>("atelier.studio.archivees", false);
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 180);

  const filtered = useMemo(() => {
    const base = showArchived
      ? tracks.filter((t) => t.archived)
      : visibleTracks;
    const q = query.trim().toLowerCase();

    return base.filter((track) => {
      if (stageFilter !== "toutes" && track.stage_id !== stageFilter) return false;
      if (priorityFilter !== "toutes" && track.priority !== priorityFilter) return false;
      if (onlyBlocked && !track.is_blocked) return false;
      if (q) {
        const haystack = `${track.title} ${track.genre ?? ""} ${track.subgenre ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tracks, visibleTracks, showArchived, stageFilter, priorityFilter, onlyBlocked, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "priorite":
        return list.sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.title.localeCompare(b.title, "fr"),
        );
      case "titre":
        return list.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      case "cible":
        return list.sort((a, b) => {
          const av = a.target_date ?? a.release_date ?? "9999";
          const bv = b.target_date ?? b.release_date ?? "9999";
          return av.localeCompare(bv);
        });
      case "progression":
        return list.sort(
          (a, b) =>
            (progressByTrack.get(b.id)?.production.percent ?? 0) -
            (progressByTrack.get(a.id)?.production.percent ?? 0),
        );
      default:
        return list.sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
    }
  }, [filtered, sort, progressByTrack]);

  const [visible, hasMore, showMore] = useProgressiveList(sorted, 40);

  const nextReminderByTrack = useMemo(() => {
    const map = new Map<string, (typeof reminders)[number]>();
    for (const reminder of [...reminders]
      .filter((r) => !r.done_at)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))) {
      if (reminder.track_id && !map.has(reminder.track_id)) map.set(reminder.track_id, reminder);
    }
    return map;
  }, [reminders]);

  const hasFilters =
    stageFilter !== "toutes" || priorityFilter !== "toutes" || onlyBlocked || query.trim() !== "";

  return (
    <div className="px-4 py-5 lg:px-6">
      {/* Première ligne : ce qui sert à chaque visite. */}
      <div className="mb-2 flex items-center gap-2">
        <SegmentedControl<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { value: "kanban", label: <IconGrid size={15} />, title: "Pipeline" },
            { value: "liste", label: <IconList size={15} />, title: "Liste" },
          ]}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Titre, genre…"
          className="min-w-0 flex-1 sm:max-w-56"
        />

        <Button variant="primary" size="sm" onClick={() => openQuickAdd("track")} className="shrink-0">
          <IconPlus size={16} />
          <span className="hidden sm:inline">Nouvelle track</span>
        </Button>
      </div>

      {/* Seconde ligne : filtres, en défilement horizontal sur mobile. */}
      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <Select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Étape"
          className="w-auto"
          wrapperClassName="shrink-0"
        >
          <option value="toutes">Toutes les étapes</option>
          {activeStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>

        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Priorité"
          className="w-auto"
          wrapperClassName="shrink-0"
        >
          <option value="toutes">Toutes priorités</option>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>

        {view === "liste" ? (
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Tri"
            className="w-auto"
            wrapperClassName="shrink-0"
          >
            <option value="activite">Dernière activité</option>
            <option value="priorite">Priorité</option>
            <option value="cible">Date cible</option>
            <option value="progression">Progression</option>
            <option value="titre">Titre</option>
          </Select>
        ) : null}

        <button
          type="button"
          onClick={() => setOnlyBlocked(!onlyBlocked)}
          className={cn(
            "h-9 shrink-0 rounded-lg border px-3 text-[13px] transition-colors duration-100",
            onlyBlocked
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-line text-muted hover:text-ink",
          )}
        >
          Bloquées
        </button>

        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "h-9 shrink-0 rounded-lg border px-3 text-[13px] transition-colors duration-100",
            showArchived
              ? "border-line-strong bg-surface-2 text-ink"
              : "border-line text-muted hover:text-ink",
          )}
        >
          Archivées
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<IconMusic size={28} />}
          title={hasFilters ? "Aucune track ne correspond" : "Aucune track pour le moment"}
          description={
            hasFilters
              ? "Modifiez les filtres pour élargir la recherche."
              : "Créez votre première track pour commencer à suivre votre pipeline."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStageFilter("toutes");
                  setPriorityFilter("toutes");
                  setOnlyBlocked(false);
                  setSearch("");
                }}
              >
                Réinitialiser les filtres
              </Button>
            ) : (
              <Button variant="primary" onClick={() => openQuickAdd("track")}>
                Créer une track
              </Button>
            )
          }
        />
      ) : view === "kanban" && !showArchived ? (
        <Kanban tracks={sorted} />
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((track) => (
              <TrackCard
                key={track.id}
                data={{
                  track,
                  workspace: track.workspace_id ? workspaceById.get(track.workspace_id) : undefined,
                  stage: track.stage_id ? stageById.get(track.stage_id) : undefined,
                  progress: progressByTrack.get(track.id)!,
                  nextReminder: nextReminderByTrack.get(track.id),
                }}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={showMore}>
                Afficher plus ({sorted.length - visible.length} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
