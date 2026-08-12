"use client";

import { useMemo, useRef, useState } from "react";
import {
  ANALYZE_FOR_LABEL,
  ANALYZE_FOR_OPTIONS,
  REFERENCE_KIND_LABEL,
} from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";
import { getMediaUrl, removeMedia, uploadMedia } from "@/lib/storage";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Modal,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { IconFolder, IconLink, IconMore, IconPlus, IconUpload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { ReferenceKind, Track, TrackFile, TrackReference } from "@/lib/types";

const LINK_KINDS: ReferenceKind[] = ["spotify", "youtube", "soundcloud", "lien", "note"];

export function ReferencesSection({ track }: { track: Track }) {
  const { userId, references, files, insert, remove, touchTrack } = useData();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("spotify");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [analyzeFor, setAnalyzeFor] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const trackReferences = useMemo(
    () =>
      references
        .filter((r) => r.track_id === track.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [references, track.id],
  );

  const trackFiles = useMemo(
    () =>
      files
        .filter((f) => f.track_id === track.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [files, track.id],
  );

  function reset() {
    setTitle("");
    setKind("spotify");
    setUrl("");
    setDescription("");
    setAnalyzeFor([]);
    setPendingFile(null);
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (pendingFile) {
        const uploaded = await uploadMedia(userId, `tracks/${track.id}/references`, pendingFile);
        filePath = uploaded.path;
        fileName = pendingFile.name;
      }
      await insert("track_references", {
        track_id: track.id,
        title: title.trim(),
        kind,
        url: url.trim() || null,
        file_path: filePath,
        file_name: fileName,
        description: description.trim() || null,
        analyze_for: analyzeFor,
      });
      touchTrack(track.id);
      toast.success("Référence ajoutée");
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function uploadTrackFile(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadMedia(userId, `tracks/${track.id}/files`, file);
      await insert("track_files", {
        track_id: track.id,
        name: file.name,
        kind: file.type || "autre",
        file_path: uploaded.path,
        file_size: file.size,
        mime_type: file.type || null,
      });
      toast.success("Fichier ajouté");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function openStoredFile(path: string) {
    try {
      const link = await getMediaUrl(path);
      window.open(link, "_blank", "noopener");
    } catch {
      toast.error("Fichier indisponible");
    }
  }

  async function destroyReference(reference: TrackReference) {
    if (reference.file_path) {
      try {
        await removeMedia(reference.file_path);
      } catch {
        // fichier déjà absent
      }
    }
    await remove("track_references", reference.id);
  }

  async function destroyFile(file: TrackFile) {
    try {
      await removeMedia(file.file_path);
    } catch {
      // fichier déjà absent
    }
    await remove("track_files", file.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <IconPlus size={16} />
          Ajouter une référence
        </Button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadTrackFile(file);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} loading={busy}>
          <IconUpload size={16} />
          Joindre un fichier
        </Button>
      </div>

      {trackReferences.length === 0 ? (
        <EmptyState title="Aucune référence ni fichier." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {trackReferences.map((reference) => (
            <Card key={reference.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {reference.title}
                    </span>
                    <Badge>{REFERENCE_KIND_LABEL[reference.kind]}</Badge>
                  </div>
                  {reference.description ? (
                    <p className="mt-1 text-[12px] leading-snug text-muted">
                      {reference.description}
                    </p>
                  ) : null}
                  {reference.analyze_for.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="text-[11px] text-faint">À analyser :</span>
                      {reference.analyze_for.map((item) => (
                        <Badge key={item} tone="accent">
                          {ANALYZE_FOR_LABEL[item] ?? item}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {reference.url ? (
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                      >
                        <IconLink size={13} />
                        Ouvrir le lien
                      </a>
                    ) : null}
                    {reference.file_path ? (
                      <button
                        type="button"
                        onClick={() => void openStoredFile(reference.file_path!)}
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                      >
                        <IconFolder size={13} />
                        {reference.file_name ?? "Ouvrir le fichier"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <Menu
                  trigger={(props) => (
                    <IconButton label="Actions" {...props}>
                      <IconMore size={16} />
                    </IconButton>
                  )}
                >
                  <MenuItem destructive onClick={() => void destroyReference(reference)}>
                    Supprimer
                  </MenuItem>
                </Menu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {trackFiles.length > 0 ? (
        <Card className="overflow-hidden">
          <header className="border-b border-line px-4 py-2.5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Fichiers joints
            </h3>
          </header>
          <ul className="divide-y divide-line">
            {trackFiles.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                <IconFolder size={16} className="shrink-0 text-faint" />
                <button
                  type="button"
                  onClick={() => void openStoredFile(file.file_path)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-ink-soft hover:text-accent"
                >
                  {file.name}
                </button>
                <span className="shrink-0 text-[11px] text-faint">
                  {formatBytes(file.file_size)} · {formatDate(file.created_at, "d MMM")}
                </span>
                <IconButton label="Supprimer" onClick={() => void destroyFile(file)}>
                  <IconMore size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle référence"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Ajouter
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titre" required>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ReferenceKind)}>
              {(Object.keys(REFERENCE_KIND_LABEL) as ReferenceKind[]).map((k) => (
                <option key={k} value={k}>
                  {REFERENCE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>

          {LINK_KINDS.includes(kind) ? (
            <Field label="Lien">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </Field>
          ) : (
            <Field label="Fichier" hint={pendingFile ? formatBytes(pendingFile.size) : undefined}>
              <input
                type="file"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
              />
            </Field>
          )}

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>

          <Field label="Ce qu'il faut analyser">
            <div className="flex flex-wrap gap-1.5">
              {ANALYZE_FOR_OPTIONS.map((option) => {
                const active = analyzeFor.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setAnalyzeFor((prev) =>
                        active ? prev.filter((item) => item !== option) : [...prev, option],
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12px] transition-colors",
                      active
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line text-muted hover:text-ink",
                    )}
                  >
                    {ANALYZE_FOR_LABEL[option]}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
