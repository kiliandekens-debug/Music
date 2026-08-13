"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accentHex } from "@/lib/constants";
import { useDebounced } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { aliasLabel, columnOf } from "@/lib/domain/board";
import { plural } from "@/lib/format";
import { Button, Modal, SearchInput, cn } from "@/components/ui";
import { PageHeader } from "@/components/layout/page-header";
import { IconPlus } from "@/components/ui/icons";
import { Board } from "@/components/tracks/board";
import { TrackForm } from "@/components/tracks/track-form";

export default function StudioPage() {
  const router = useRouter();
  const { workspaces } = useData();
  const { visibleTracks, suggestions, stageById } = useDerived();
  const { workspaceId, setWorkspaceId } = useUi();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useDebounced(search, 180);

  const aliases = workspaces.filter((w) => !w.archived).sort((a, b) => a.position - b.position);

  const inProgress = useMemo(
    () =>
      visibleTracks.filter((t) => {
        const stage = t.stage_id ? stageById.get(t.stage_id) : undefined;
        return columnOf(stage) === "en_cours";
      }).length,
    [visibleTracks, stageById],
  );

  const tracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleTracks;
    return visibleTracks.filter((track) =>
      `${track.title} ${track.genre ?? ""} ${track.subgenre ?? ""}`.toLowerCase().includes(q),
    );
  }, [visibleTracks, query]);

  /*
   * Une seule urgence est rappelée en haut, et seulement si elle est vraiment
   * urgente : le reste vit déjà sur les cartes, où se trouve la track concernée.
   * Un bandeau de rappels qui répète le tableau repousse le tableau hors de
   * l'écran sans rien apprendre.
   */
  const urgent = useMemo(
    () =>
      suggestions.find(
        (s) => !s.promoTaskId && !s.submissionId && (s.tone === "danger" || s.tone === "warn"),
      ),
    [suggestions],
  );

  return (
    <div className="mx-auto w-full max-w-[1560px] px-5 pb-28 pt-4 lg:px-10 lg:pb-32 lg:pt-9">
      <PageHeader
        title="Mes tracks"
        eyebrow={
          <>
            {plural(visibleTracks.length, "track")}
            {inProgress > 0 ? ` · ${inProgress} en cours` : ""}
          </>
        }
        action={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher"
            className="hidden w-56 sm:block"
          />
        }
        filters={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher une track"
              className="mb-3 sm:hidden"
            />
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
              <AliasChip
                label="Toutes"
                active={workspaceId === "tous"}
                onClick={() => setWorkspaceId("tous")}
              />
              {aliases.map((workspace) => (
                <AliasChip
                  key={workspace.id}
                  label={aliasLabel(workspace.name) ?? workspace.name}
                  color={accentHex(workspace.color)}
                  active={workspaceId === workspace.id}
                  onClick={() => setWorkspaceId(workspace.id)}
                />
              ))}
            </div>
          </>
        }
      />

      {urgent ? (
        <Link
          href={urgent.href}
          className="mb-4 flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/[0.07] px-4 py-2.5 text-sm leading-snug transition-colors duration-100 hover:bg-danger/[0.12] lg:mb-5 lg:items-center"
        >
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger lg:mt-0" aria-hidden />
          <span className="line-clamp-2-safe min-w-0 flex-1">
            <span className="font-medium text-ink">{urgent.title}</span>
            <span className="text-muted"> · {urgent.reason}</span>
          </span>
        </Link>
      ) : null}

      {tracks.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-4 text-base text-muted">
          {query.trim()
            ? "Aucune track ne correspond à cette recherche."
            : "Aucune track pour le moment."}
          {query.trim() ? null : (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Crée ta première track
            </Button>
          )}
        </p>
      ) : (
        <Board tracks={tracks} />
      )}

      {/* Une seule action d'ajout, toujours au même endroit : au pouce.
          Un voile dégradé passe sous le bouton pour que les cartes glissent
          dessous au lieu de le heurter. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-44 bg-gradient-to-t from-canvas via-canvas/90 to-transparent lg:h-28"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Nouvelle track"
        title="Nouvelle track"
        /* Centré partout : les flèches des cartes vivent à droite, le bouton ne doit
             pas venir se poser dessus. */
          className="fixed bottom-24 left-1/2 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_28px_-6px_var(--accent)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95 lg:bottom-8"
      >
        <IconPlus size={24} />
      </button>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle track" size="lg">
        <TrackForm
          onDone={(trackId) => {
            setCreating(false);
            router.push(`/studio/${trackId}`);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}

function AliasChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-100",
        active
          ? "border-line-strong bg-surface-3 text-ink"
          : "border-line bg-surface text-muted hover:text-ink-soft",
      )}
    >
      {color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.65 }}
          aria-hidden
        />
      ) : null}
      {label}
    </button>
  );
}
