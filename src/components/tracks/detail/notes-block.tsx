"use client";

import { CopyButton } from "@/components/ui";
import { NotesField } from "./notes-field";
import { ArtworkCard } from "./artwork-card";
import { ReferencesSection } from "./references-section";
import type { Track } from "@/lib/types";

/** Tout ce qui gravite autour de la track : notes, références, liens, fichiers. */
export function NotesBlock({ track }: { track: Track }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Notes générales</h3>
        <NotesField
          trackId={track.id}
          value={track.notes}
          rows={5}
          placeholder="Intentions, retours d'écoute, ce qu'il reste à faire…"
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Artwork</h3>
        <ArtworkCard track={track} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">
          Références, liens et fichiers
        </h3>
        <ReferencesSection track={track} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Projet Ableton</h3>
        {track.ableton_path ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-sm text-ink-soft">
              {track.ableton_path}
            </code>
            <CopyButton value={track.ableton_path} label="Copier le chemin" />
          </div>
        ) : (
          <p className="text-sm text-muted">
            Aucun chemin enregistré. Le navigateur ne peut pas ouvrir un fichier local : le chemin
            sert à le retrouver.
          </p>
        )}
      </section>
    </div>
  );
}
