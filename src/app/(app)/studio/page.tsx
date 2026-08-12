"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accentHex } from "@/lib/constants";
import { useDebounced } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { aliasLabel } from "@/lib/domain/board";
import { Button, Modal, SearchInput, cn } from "@/components/ui";
import { IconPlus } from "@/components/ui/icons";
import { Board } from "@/components/tracks/board";
import { TrackForm } from "@/components/tracks/track-form";

export default function StudioPage() {
  const router = useRouter();
  const { workspaces } = useData();
  const { visibleTracks, suggestions } = useDerived();
  const { workspaceId, setWorkspaceId } = useUi();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useDebounced(search, 180);

  const aliases = workspaces.filter((w) => !w.archived).sort((a, b) => a.position - b.position);

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
    <div className="mx-auto w-full max-w-[1560px] px-5 py-4 lg:px-10 lg:py-9">
      <header className="mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-page font-semibold leading-[1.1] tracking-[-0.02em]">Mes tracks</h1>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher"
            className="ml-auto hidden w-56 sm:block"
          />
          <Button
            variant="primary"
            size="lg"
            onClick={() => setCreating(true)}
            className="ml-auto shrink-0 sm:ml-0"
          >
            <IconPlus size={17} />
            <span className="sm:hidden">Nouvelle</span>
            <span className="hidden sm:inline">Nouvelle track</span>
          </Button>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une track"
          className="mt-3 sm:hidden"
        />

        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-4 lg:px-0">
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
      </header>

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
