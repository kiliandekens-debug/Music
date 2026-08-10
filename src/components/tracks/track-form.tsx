"use client";

import { useState } from "react";
import { MUSICAL_KEYS, PRIORITY_LABEL } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Priority, Track } from "@/lib/types";

export interface TrackDraft {
  title: string;
  workspace_id: string | null;
  stage_id: string | null;
  genre: string;
  subgenre: string;
  bpm: string;
  musical_key: string;
  priority: Priority;
  target_date: string;
  release_date: string;
  intended_label_id: string | null;
  distributor: string;
  ableton_path: string;
  notes: string;
}

function draftFromTrack(track: Track): TrackDraft {
  return {
    title: track.title,
    workspace_id: track.workspace_id,
    stage_id: track.stage_id,
    genre: track.genre ?? "",
    subgenre: track.subgenre ?? "",
    bpm: track.bpm !== null ? String(track.bpm) : "",
    musical_key: track.musical_key ?? "",
    priority: track.priority,
    target_date: track.target_date ?? "",
    release_date: track.release_date ?? "",
    intended_label_id: track.intended_label_id,
    distributor: track.distributor ?? "",
    ableton_path: track.ableton_path ?? "",
    notes: track.notes ?? "",
  };
}

export function draftToValues(draft: TrackDraft) {
  const bpm = draft.bpm.trim() === "" ? null : Number(draft.bpm.replace(",", "."));
  return {
    title: draft.title.trim(),
    workspace_id: draft.workspace_id,
    stage_id: draft.stage_id,
    genre: draft.genre.trim() || null,
    subgenre: draft.subgenre.trim() || null,
    bpm: bpm !== null && Number.isFinite(bpm) ? bpm : null,
    musical_key: draft.musical_key || null,
    priority: draft.priority,
    target_date: draft.target_date || null,
    release_date: draft.release_date || null,
    intended_label_id: draft.intended_label_id || null,
    distributor: draft.distributor.trim() || null,
    ableton_path: draft.ableton_path.trim() || null,
    notes: draft.notes.trim() || null,
  };
}

/**
 * Formulaire de track. Sert à la création (ajout rapide, Studio) et à
 * l'édition complète depuis la fiche.
 */
export function TrackForm({
  track,
  compact,
  onDone,
  onCancel,
}: {
  track?: Track;
  /** Version courte : titre, espace, étape, priorité seulement. */
  compact?: boolean;
  onDone: (trackId: string) => void;
  onCancel?: () => void;
}) {
  const { workspaces, stages, labels, insert, update, tracks, log } = useData();
  const { workspaceId } = useUi();
  const toast = useToast();

  const activeStages = stages.filter((s) => !s.archived).sort((a, b) => a.position - b.position);
  const activeWorkspaces = workspaces.filter((w) => !w.archived);

  const [draft, setDraft] = useState<TrackDraft>(() =>
    track
      ? draftFromTrack(track)
      : {
          title: "",
          workspace_id:
            workspaceId !== "tous" ? workspaceId : (activeWorkspaces[0]?.id ?? null),
          stage_id: activeStages[0]?.id ?? null,
          genre: "",
          subgenre: "",
          bpm: "",
          musical_key: "",
          priority: "normale",
          target_date: "",
          release_date: "",
          intended_label_id: null,
          distributor: "",
          ableton_path: "",
          notes: "",
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TrackDraft>(key: K, value: TrackDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    if (!draft.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const values = draftToValues(draft);
      if (track) {
        await update("tracks", track.id, values);
        log({
          entity_type: "track",
          entity_id: track.id,
          track_id: track.id,
          action: "track_modifiee",
          summary: `Informations générales mises à jour`,
        });
        onDone(track.id);
      } else {
        const position = tracks.reduce((max, t) => Math.max(max, t.position), 0) + 1;
        const created = await insert("tracks", { ...values, position });
        log({
          entity_type: "track",
          entity_id: created.id,
          track_id: created.id,
          action: "track_creee",
          summary: `Track « ${created.title} » créée`,
        });
        toast.success(`« ${created.title} » ajoutée`);
        onDone(created.id);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Titre" required error={error}>
        <Input
          autoFocus
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Nom de la track"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Espace">
          <Select
            value={draft.workspace_id ?? ""}
            onChange={(e) => set("workspace_id", e.target.value || null)}
          >
            <option value="">Aucun</option>
            {activeWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Étape">
          <Select
            value={draft.stage_id ?? ""}
            onChange={(e) => set("stage_id", e.target.value || null)}
          >
            <option value="">Aucune</option>
            {activeStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priorité">
          <Select
            value={draft.priority}
            onChange={(e) => set("priority", e.target.value as Priority)}
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date cible">
          <Input
            type="date"
            value={draft.target_date}
            onChange={(e) => set("target_date", e.target.value)}
          />
        </Field>
      </div>

      {!compact ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Genre">
              <Input
                value={draft.genre}
                onChange={(e) => set("genre", e.target.value)}
                placeholder="Melodic techno, house…"
              />
            </Field>
            <Field label="Sous-genre">
              <Input value={draft.subgenre} onChange={(e) => set("subgenre", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="BPM">
              <Input
                inputMode="decimal"
                value={draft.bpm}
                onChange={(e) => set("bpm", e.target.value)}
                placeholder="124"
              />
            </Field>
            <Field label="Tonalité">
              <Select
                value={draft.musical_key}
                onChange={(e) => set("musical_key", e.target.value)}
              >
                <option value="">—</option>
                {MUSICAL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label envisagé">
              <Select
                value={draft.intended_label_id ?? ""}
                onChange={(e) => set("intended_label_id", e.target.value || null)}
              >
                <option value="">—</option>
                {labels
                  .filter((l) => !l.archived)
                  .map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Distributeur">
              <Input
                value={draft.distributor}
                onChange={(e) => set("distributor", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Date de sortie">
            <Input
              type="date"
              value={draft.release_date}
              onChange={(e) => set("release_date", e.target.value)}
            />
          </Field>

          <Field
            label="Projet Ableton"
            hint="Chemin ou lien du projet. Le navigateur ne peut pas ouvrir un fichier local : le chemin est copiable."
          >
            <Input
              value={draft.ableton_path}
              onChange={(e) => set("ableton_path", e.target.value)}
              placeholder="D:\Musique\Projets\ma-track Project\ma-track.als"
            />
          </Field>

          <Field label="Notes">
            <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </Field>
        </>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} type="button">
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {track ? "Enregistrer" : "Créer la track"}
        </Button>
      </div>
    </form>
  );
}
