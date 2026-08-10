"use client";

import { useMemo, useRef, useState } from "react";
import {
  AUDIO_ACCEPT,
  AUDIO_KIND_LABEL,
  LARGE_FILE_WARNING_BYTES,
} from "@/lib/constants";
import { formatBytes, formatClock, formatDate } from "@/lib/format";
import { readAudioDuration, removeMedia, uploadMedia } from "@/lib/storage";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { IconMore, IconMusic, IconUpload, IconWarning } from "@/components/ui/icons";
import { AudioPlayer, useAudioPlayer } from "@/components/audio/player";
import { useToast } from "@/components/ui/toast";
import type { AudioKind, AudioVersion, Track } from "@/lib/types";

export function VersionsTab({ track }: { track: Track }) {
  const { userId, audioVersions, insert, update, remove, log, touchTrack } = useData();
  const { select, currentId } = useAudioPlayer();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const versions = useMemo(
    () =>
      audioVersions
        .filter((v) => v.track_id === track.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [audioVersions, track.id],
  );

  const [pending, setPending] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AudioKind>("demo");
  const [comment, setComment] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<AudioVersion | null>(null);
  const [toDelete, setToDelete] = useState<AudioVersion | null>(null);

  function choose(file: File | null) {
    if (!file) return;
    setPending(file);
    setName(file.name.replace(/\.[^.]+$/, ""));
    setKind(versions.length === 0 ? "demo" : "mix_v1");
    setComment("");
    setIsMain(versions.length === 0);
  }

  async function upload() {
    if (!pending) return;
    setUploading(true);
    try {
      const duration = await readAudioDuration(pending);
      const { path } = await uploadMedia(userId, `tracks/${track.id}/audio`, pending);
      const nextNumber =
        versions.filter((v) => v.kind === kind).reduce((max, v) => Math.max(max, v.version_number), 0) +
        1;

      const created = await insert("audio_versions", {
        track_id: track.id,
        name: name.trim() || pending.name,
        kind,
        version_number: nextNumber,
        file_path: path,
        file_name: pending.name,
        file_size: pending.size,
        mime_type: pending.type || null,
        duration_seconds: duration,
        comment: comment.trim() || null,
        is_main: isMain,
      });

      if (isMain) {
        for (const version of versions.filter((v) => v.is_main)) {
          await update("audio_versions", version.id, { is_main: false });
        }
      }

      log({
        entity_type: "audio_version",
        entity_id: created.id,
        track_id: track.id,
        action: "version_ajoutee",
        summary: `Version « ${created.name} » ajoutée`,
      });
      touchTrack(track.id);
      toast.success("Version ajoutée");
      setPending(null);
      select(created.id);
    } catch (e) {
      toast.error(
        e instanceof Error ? `Envoi impossible : ${e.message}` : "Envoi impossible",
      );
    } finally {
      setUploading(false);
    }
  }

  async function setMain(version: AudioVersion) {
    for (const other of versions.filter((v) => v.is_main && v.id !== version.id)) {
      await update("audio_versions", other.id, { is_main: false });
    }
    await update("audio_versions", version.id, { is_main: true });
  }

  async function destroy(version: AudioVersion) {
    if (version.file_path) {
      try {
        await removeMedia(version.file_path);
      } catch {
        // Le fichier a peut-être déjà disparu du stockage : on retire la ligne.
      }
    }
    await remove("audio_versions", version.id);
    toast.success("Version supprimée");
  }

  const isLargeWav =
    pending !== null &&
    pending.size > LARGE_FILE_WARNING_BYTES &&
    /wav$/i.test(pending.name);

  return (
    <div className="space-y-4">
      <AudioPlayer />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={AUDIO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button variant="primary" size="sm" onClick={() => fileInput.current?.click()}>
          <IconUpload size={16} />
          Ajouter une version
        </Button>
        <span className="text-[12px] text-faint">MP3, M4A ou WAV</span>
      </div>

      {versions.length === 0 ? (
        <EmptyState
          icon={<IconMusic size={26} />}
          title="Aucune version audio"
          description="Ajoutez une démo, un mix ou un master pour écouter la track et poser des corrections horodatées."
        />
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <Card
              key={version.id}
              className={cn(
                "flex items-start gap-3 p-3",
                currentId === version.id && "border-accent/40",
              )}
            >
              <button
                type="button"
                onClick={() => version.file_path && select(version.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{version.name}</span>
                  <Badge>{AUDIO_KIND_LABEL[version.kind]}</Badge>
                  {version.is_main ? <Badge tone="accent">Version principale</Badge> : null}
                  {currentId === version.id ? <Badge tone="info">Sélectionnée</Badge> : null}
                </div>
                <p className="mt-1 text-[11px] text-faint">
                  {[
                    formatDate(version.created_at),
                    version.duration_seconds ? formatClock(version.duration_seconds) : null,
                    formatBytes(version.file_size),
                    version.file_name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {version.comment ? (
                  <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{version.comment}</p>
                ) : null}
              </button>

              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={16} />
                  </IconButton>
                )}
              >
                <MenuItem onClick={() => setEditing(version)}>Modifier</MenuItem>
                <MenuItem disabled={version.is_main} onClick={() => void setMain(version)}>
                  Définir comme principale
                </MenuItem>
                <MenuSeparator />
                <MenuItem destructive onClick={() => setToDelete(version)}>
                  Supprimer
                </MenuItem>
              </Menu>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Nouvelle version audio"
        description={pending ? `${pending.name} · ${formatBytes(pending.size)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="primary" loading={uploading} onClick={() => void upload()}>
              Envoyer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isLargeWav ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/10 p-3 text-[13px] text-ink-soft">
              <IconWarning size={18} className="mt-0.5 shrink-0 text-warn" />
              <p>
                Ce WAV pèse {formatBytes(pending?.size ?? 0)}. Pour l&apos;écoute courante, un MP3
                320 suffit et économise beaucoup d&apos;espace de stockage. Gardez le WAV pour le
                master final.
              </p>
            </div>
          ) : null}

          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Type de version">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AudioKind)}>
              {(Object.keys(AUDIO_KIND_LABEL) as AudioKind[]).map((k) => (
                <option key={k} value={k}>
                  {AUDIO_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Commentaire">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMain}
              onChange={(e) => setIsMain(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Définir comme version principale
          </label>
        </div>
      </Modal>

      <EditVersionModal
        version={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return;
          await update("audio_versions", editing.id, values);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cette version ?"
        destructive
        confirmLabel="Supprimer"
        message={
          <>
            Le fichier audio et les corrections horodatées associées seront supprimés
            définitivement.
          </>
        }
        onConfirm={() => {
          if (toDelete) void destroy(toDelete);
        }}
      />
    </div>
  );
}

function EditVersionModal({
  version,
  onClose,
  onSave,
}: {
  version: AudioVersion | null;
  onClose: () => void;
  onSave: (values: Partial<AudioVersion>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AudioKind>("autre");
  const [comment, setComment] = useState("");
  const [versionNumber, setVersionNumber] = useState("1");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (version && version.id !== loadedId) {
    setLoadedId(version.id);
    setName(version.name);
    setKind(version.kind);
    setComment(version.comment ?? "");
    setVersionNumber(String(version.version_number));
  }

  return (
    <Modal
      open={version !== null}
      onClose={onClose}
      title="Modifier la version"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              void onSave({
                name: name.trim(),
                kind,
                comment: comment.trim() || null,
                version_number: Math.max(1, Number(versionNumber) || 1),
              })
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AudioKind)}>
              {(Object.keys(AUDIO_KIND_LABEL) as AudioKind[]).map((k) => (
                <option key={k} value={k}>
                  {AUDIO_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Numéro de version">
            <Input
              type="number"
              min={1}
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Commentaire">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
