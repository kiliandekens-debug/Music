"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounced } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { aliasLabel } from "@/lib/domain/board";
import { Button, Modal, SearchInput, cn } from "@/components/ui";
import { IconArrowRight, IconPlus } from "@/components/ui/icons";
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
   * « À faire maintenant » ne montre que du travail de production : les
   * relances vivent sur la page Labels et les actions de communication sur la
   * page Promotion. Sans action réelle, la zone disparaît entièrement.
   */
  const todo = useMemo(
    () => suggestions.filter((s) => !s.promoTaskId && !s.submissionId).slice(0, 3),
    [suggestions],
  );

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight">Mes tracks</h1>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Nouvelle track
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <AliasChip
              label="Toutes"
              active={workspaceId === "tous"}
              onClick={() => setWorkspaceId("tous")}
            />
            {aliases.map((workspace) => (
              <AliasChip
                key={workspace.id}
                label={aliasLabel(workspace.name) ?? workspace.name}
                active={workspaceId === workspace.id}
                onClick={() => setWorkspaceId(workspace.id)}
              />
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher"
            className="ml-auto w-full sm:w-52"
          />
        </div>
      </header>

      {todo.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">À faire maintenant</h2>
          <ul className="space-y-1.5">
            {todo.map((suggestion) => (
              <li key={suggestion.id}>
                <Link
                  href={suggestion.href}
                  className="card card-hover flex items-center gap-3 px-3.5 py-3"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      suggestion.tone === "danger"
                        ? "bg-danger"
                        : suggestion.tone === "warn"
                          ? "bg-warn"
                          : "bg-accent",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {suggestion.title}
                    </span>
                    <span className="block truncate text-[12px] text-faint">
                      {suggestion.reason}
                    </span>
                  </span>
                  <IconArrowRight size={16} className="shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tracks.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-3 text-[14px] text-muted">
          {query.trim()
            ? "Aucune track ne correspond à cette recherche."
            : "Aucune track pour le moment."}
          {query.trim() ? null : (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
        active
          ? "border-accent/40 bg-accent-soft text-accent-ink"
          : "border-line text-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
