"use client";

import { useMemo, useState } from "react";
import { NOTE_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { formatClock, formatDate, parseClock } from "@/lib/format";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Select,
  cn,
} from "@/components/ui";
import { IconMore, IconNote, IconPlus } from "@/components/ui/icons";
import { AudioPlayer, useAudioPlayer } from "@/components/audio/player";
import { useToast } from "@/components/ui/toast";
import type { NoteCategory, Priority, TimestampNote, Track } from "@/lib/types";

/**
 * Corrections horodatées : on écoute, on note à l'instant exact, et un clic
 * sur une correction ramène le lecteur à cet endroit.
 */
export function CorrectionsSection({ track }: { track: Track }) {
  const { timestampNotes, audioVersions, insert, update, remove, touchTrack } = useData();
  const { current, currentTime, goTo, versions } = useAudioPlayer();
  const toast = useToast();

  const [text, setText] = useState("");
  const [timecode, setTimecode] = useState("");
  const [category, setCategory] = useState<NoteCategory>("mixage");
  const [priority, setPriority] = useState<Priority>("normale");
  const [showResolved, setShowResolved] = useState(false);
  const [versionFilter, setVersionFilter] = useState("toutes");
  const [busy, setBusy] = useState(false);

  const trackVersions = useMemo(
    () => audioVersions.filter((v) => v.track_id === track.id),
    [audioVersions, track.id],
  );
  const versionById = useMemo(
    () => new Map(trackVersions.map((v) => [v.id, v])),
    [trackVersions],
  );

  const notes = useMemo(() => {
    return timestampNotes
      .filter((note) => {
        if (note.track_id !== track.id) return false;
        if (!showResolved && note.resolved_at) return false;
        if (versionFilter !== "toutes" && note.audio_version_id !== versionFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.audio_version_id !== b.audio_version_id) {
          const av = versionById.get(a.audio_version_id)?.created_at ?? "";
          const bv = versionById.get(b.audio_version_id)?.created_at ?? "";
          return bv.localeCompare(av);
        }
        return a.position_seconds - b.position_seconds;
      });
  }, [timestampNotes, track.id, showResolved, versionFilter, versionById]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimestampNote[]>();
    for (const note of notes) {
      const list = map.get(note.audio_version_id);
      if (list) list.push(note);
      else map.set(note.audio_version_id, [note]);
    }
    return [...map.entries()];
  }, [notes]);

  async function add() {
    if (!current) {
      toast.error("Sélectionnez d'abord une version audio.");
      return;
    }
    if (!text.trim()) return;

    const parsed = timecode.trim() ? parseClock(timecode) : Math.floor(currentTime);
    if (parsed === null) {
      toast.error("Horodatage invalide. Utilisez le format 2:34.");
      return;
    }

    setBusy(true);
    try {
      await insert("timestamp_notes", {
        track_id: track.id,
        audio_version_id: current.id,
        position_seconds: parsed,
        text: text.trim(),
        category,
        priority,
      });
      setText("");
      setTimecode("");
      touchTrack(track.id);
    } finally {
      setBusy(false);
    }
  }

  if (versions.length === 0) {
    return (
      <EmptyState title="Ajoutez d'abord une version audio pour poser des corrections horodatées." />
    );
  }

  return (
    <div className="space-y-4">
      <AudioPlayer compact />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Correction à</span>
          <input
            value={timecode}
            onChange={(e) => setTimecode(e.target.value)}
            placeholder={formatClock(currentTime)}
            aria-label="Horodatage"
            className="tabular h-8 w-20 rounded-lg border border-line bg-surface-2 px-2 text-center text-sm focus:border-accent focus:outline-none"
          />
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoteCategory)}
            className="w-auto"
          >
            {(Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[]).map((c) => (
              <option key={c} value={c}>
                {NOTE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-auto"
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <span className="text-label text-muted">
            sur « {current?.name ?? "aucune version"} »
          </span>
        </div>

        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void add();
              }
            }}
            rows={2}
            placeholder="Le lead est trop faible et le kick perd de l'impact…"
            className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <Button variant="primary" loading={busy} onClick={() => void add()} disabled={!text.trim()}>
            <IconPlus size={16} />
            Ajouter
          </Button>
        </div>
        <p className="mt-1.5 text-label text-muted">
          Laissez l&apos;horodatage vide pour utiliser la position actuelle du lecteur
          ({formatClock(currentTime)}). Ctrl + Entrée pour ajouter.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={showResolved}
          onChange={setShowResolved}
          label="Afficher les corrections résolues"
        />
        <Select
          value={versionFilter}
          onChange={(e) => setVersionFilter(e.target.value)}
          className="w-auto"
          aria-label="Filtrer par version"
        >
          <option value="toutes">Toutes les versions</option>
          {trackVersions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.name}
            </option>
          ))}
        </Select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="Aucune correction notée." />
      ) : (
        grouped.map(([versionId, list]) => (
          <Card key={versionId} className="overflow-hidden">
            <header className="border-b border-line px-4 py-2.5">
              <h3 className="text-sm font-medium text-ink">
                {versionById.get(versionId)?.name ?? "Version supprimée"}
                <span className="ml-2 text-label font-normal text-muted">
                  {list.length} correction{list.length > 1 ? "s" : ""}
                </span>
              </h3>
            </header>
            <ul className="divide-y divide-line">
              {list.map((note) => (
                <li key={note.id} className="group flex items-start gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => goTo(note.audio_version_id, note.position_seconds)}
                    className="tabular shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-sm font-medium text-accent hover:brightness-125"
                    title="Écouter à cet instant"
                  >
                    {formatClock(note.position_seconds)}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        note.resolved_at ? "text-muted line-through" : "text-ink-soft",
                      )}
                    >
                      {note.text}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge>{NOTE_CATEGORY_LABEL[note.category]}</Badge>
                      {note.priority !== "normale" ? (
                        <Badge tone={note.priority === "urgente" ? "danger" : "warn"}>
                          {PRIORITY_LABEL[note.priority]}
                        </Badge>
                      ) : null}
                      {note.resolved_at ? (
                        <Badge tone="ok">Résolue le {formatDate(note.resolved_at, "d MMM")}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={Boolean(note.resolved_at)}
                      onChange={(checked) =>
                        void update("timestamp_notes", note.id, {
                          resolved_at: checked ? new Date().toISOString() : null,
                        })
                      }
                    />
                    <Menu
                      trigger={(props) => (
                        <IconButton
                          label="Actions"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                          {...props}
                        >
                          <IconMore size={16} />
                        </IconButton>
                      )}
                    >
                      <MenuLabel>Catégorie</MenuLabel>
                      {(Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[]).map((c) => (
                        <MenuItem
                          key={c}
                          disabled={note.category === c}
                          onClick={() => void update("timestamp_notes", note.id, { category: c })}
                        >
                          {NOTE_CATEGORY_LABEL[c]}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem destructive onClick={() => void remove("timestamp_notes", note.id)}>
                        Supprimer
                      </MenuItem>
                    </Menu>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
