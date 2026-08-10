"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NOTE_CATEGORY_LABEL } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import { useElapsedSeconds } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useSession } from "@/lib/store/session";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { IconPause, IconPlay, IconPlus, IconSession } from "@/components/ui/icons";
import { AudioPlayer, AudioPlayerProvider, useAudioPlayer } from "@/components/audio/player";
import type { NoteCategory } from "@/lib/types";

export default function SessionModePage() {
  const { active } = useSession();
  const { audioVersions } = useData();

  const versions = useMemo(
    () => audioVersions.filter((v) => v.track_id === active?.track_id),
    [audioVersions, active?.track_id],
  );

  if (!active) {
    return (
      <div className="px-4 py-10 lg:px-6">
        <EmptyState
          icon={<IconSession size={28} />}
          title="Aucune session en cours"
          description="Démarrez une session depuis une track ou depuis la page Sessions."
          action={
            <Link href="/sessions">
              <Button variant="primary">Aller aux sessions</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <AudioPlayerProvider versions={versions}>
      <SessionModeContent />
    </AudioPlayerProvider>
  );
}

function SessionModeContent() {
  const router = useRouter();
  const { tracks, tasks, timestampNotes, insert, update, touchTrack } = useData();
  const { active, paused, baseSeconds, togglePause, finish, cancel } = useSession();
  const live = useElapsedSeconds(active?.started_at ?? null, !paused);
  const elapsed = paused ? baseSeconds : live;

  const [notes, setNotes] = useState(active?.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(true);
  const notesTimer = useRef<number | null>(null);

  const [correction, setCorrection] = useState("");
  const [category, setCategory] = useState<NoteCategory>("mixage");
  const [finishing, setFinishing] = useState(false);

  const track = tracks.find((t) => t.id === active?.track_id);
  const sessionTasks = useMemo(
    () => tasks.filter((t) => (active?.task_ids ?? []).includes(t.id)),
    [tasks, active?.task_ids],
  );
  const openCorrections = useMemo(
    () =>
      timestampNotes
        .filter((n) => n.track_id === active?.track_id && !n.resolved_at)
        .sort((a, b) => a.position_seconds - b.position_seconds),
    [timestampNotes, active?.track_id],
  );

  useEffect(() => {
    return () => {
      if (notesTimer.current) window.clearTimeout(notesTimer.current);
    };
  }, []);

  function onNotesChange(value: string) {
    setNotes(value);
    setSavedNotes(false);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      if (!active) return;
      void update("work_sessions", active.id, { notes: value || null }).then(() =>
        setSavedNotes(true),
      );
    }, 800);
  }

  if (!active) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <header className="mb-6 text-center">
        <p className="text-[12px] uppercase tracking-wide text-faint">Mode Session</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {track?.title ?? "Session libre"}
        </h1>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Reprendre" : "Mettre en pause"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            {paused ? <IconPlay size={18} /> : <IconPause size={18} />}
          </button>
          <p
            className={cn(
              "tabular text-5xl font-semibold tracking-tight",
              paused ? "text-muted" : "text-ink",
            )}
          >
            {formatClock(elapsed)}
          </p>
        </div>
        {paused ? <p className="mt-2 text-[13px] text-warn">Session en pause</p> : null}
      </header>

      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Tâches de la session
          </h2>
          {sessionTasks.length === 0 ? (
            <p className="text-[13px] text-faint">
              Aucune tâche sélectionnée — session libre.
            </p>
          ) : (
            <ul className="space-y-2">
              {sessionTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2.5">
                  <Checkbox
                    checked={task.status === "terminee"}
                    onChange={(checked) => {
                      void update("track_tasks", task.id, {
                        status: checked ? "terminee" : "en_cours",
                        completed_at: checked ? new Date().toISOString() : null,
                      });
                      touchTrack(active.track_id);
                    }}
                  />
                  <span
                    className={cn(
                      "text-[14px] leading-snug",
                      task.status === "terminee" ? "text-faint line-through" : "text-ink",
                    )}
                  >
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <AudioPlayer />

        <CorrectionBox
          trackId={active.track_id}
          correction={correction}
          setCorrection={setCorrection}
          category={category}
          setCategory={setCategory}
          onAdd={async (seconds, versionId) => {
            if (!active.track_id || !versionId) return;
            await insert("timestamp_notes", {
              track_id: active.track_id,
              audio_version_id: versionId,
              position_seconds: seconds,
              text: correction.trim(),
              category,
            });
            setCorrection("");
          }}
        />

        {openCorrections.length > 0 ? (
          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Corrections en cours
            </h2>
            <ul className="space-y-1.5">
              {openCorrections.slice(0, 12).map((note) => (
                <li key={note.id} className="flex items-start gap-2.5">
                  <Checkbox
                    checked={false}
                    onChange={() =>
                      void update("timestamp_notes", note.id, {
                        resolved_at: new Date().toISOString(),
                      })
                    }
                  />
                  <SeekLine versionId={note.audio_version_id} seconds={note.position_seconds} />
                  <span className="min-w-0 flex-1 text-[13px] text-ink-soft">{note.text}</span>
                  <Badge>{NOTE_CATEGORY_LABEL[note.category]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Bloc-notes
            </h2>
            <span className="text-[11px] text-faint">
              {savedNotes ? "Enregistré" : "Enregistrement…"}
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={5}
            placeholder="Ce que vous testez, ce qui marche, ce qu'il faudra reprendre…"
            className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </Card>

        <div className="flex items-center justify-between gap-2 pb-6">
          <Button
            variant="ghost"
            onClick={() => {
              void cancel().then(() => router.push("/sessions"));
            }}
          >
            Abandonner
          </Button>
          <Button variant="primary" size="lg" onClick={() => setFinishing(true)}>
            Terminer la session
          </Button>
        </div>
      </div>

      <FinishDialog
        open={finishing}
        onClose={() => setFinishing(false)}
        taskIds={active.task_ids}
        onFinish={async (input) => {
          await finish(input);
          setFinishing(false);
          router.push("/sessions");
        }}
      />
    </div>
  );
}

function SeekLine({ versionId, seconds }: { versionId: string; seconds: number }) {
  const { goTo } = useAudioPlayer();
  return (
    <button
      type="button"
      onClick={() => goTo(versionId, seconds)}
      className="tabular shrink-0 text-[12px] text-accent hover:underline"
    >
      {formatClock(seconds)}
    </button>
  );
}

function CorrectionBox({
  trackId,
  correction,
  setCorrection,
  category,
  setCategory,
  onAdd,
}: {
  trackId: string | null;
  correction: string;
  setCorrection: (value: string) => void;
  category: NoteCategory;
  setCategory: (value: NoteCategory) => void;
  onAdd: (seconds: number, versionId: string | null) => Promise<void>;
}) {
  const { currentTime, current, versions } = useAudioPlayer();

  if (!trackId || versions.length === 0) return null;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[12px] text-accent">
          {formatClock(currentTime)}
        </span>
        <input
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && correction.trim()) {
              e.preventDefault();
              void onAdd(Math.floor(currentTime), current?.id ?? null);
            }
          }}
          placeholder="Noter une correction à cet instant…"
          className="h-9 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as NoteCategory)}
          className="w-auto"
          aria-label="Catégorie"
        >
          {(Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[]).map((c) => (
            <option key={c} value={c}>
              {NOTE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="primary"
          disabled={!correction.trim()}
          onClick={() => void onAdd(Math.floor(currentTime), current?.id ?? null)}
        >
          <IconPlus size={15} />
        </Button>
      </div>
    </Card>
  );
}

function FinishDialog({
  open,
  onClose,
  taskIds,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  taskIds: string[];
  onFinish: (input: {
    doneSummary: string;
    remainingSummary: string;
    blocker: string;
    nextAction: string;
    notes: string;
    completedTaskIds: string[];
    newTaskTitle?: string;
  }) => Promise<void>;
}) {
  const { tasks } = useData();
  const [done, setDone] = useState("");
  const [remaining, setRemaining] = useState("");
  const [blocker, setBlocker] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [newTask, setNewTask] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const sessionTasks = tasks.filter((t) => taskIds.includes(t.id));

  useEffect(() => {
    if (open) {
      setCompleted(sessionTasks.filter((t) => t.status === "terminee").map((t) => t.id));
    }
    // Réinitialise uniquement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Terminer la session"
      description="Deux minutes de bilan qui font gagner la prochaine session."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Continuer la session
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void onFinish({
                doneSummary: done,
                remainingSummary: remaining,
                blocker,
                nextAction,
                notes: "",
                completedTaskIds: completed,
                newTaskTitle: newTask,
              }).finally(() => setBusy(false));
            }}
          >
            Enregistrer et terminer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {sessionTasks.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">
              Tâches terminées
            </p>
            <div className="space-y-1.5">
              {sessionTasks.map((task) => (
                <Checkbox
                  key={task.id}
                  checked={completed.includes(task.id)}
                  onChange={(checked) =>
                    setCompleted((prev) =>
                      checked ? [...prev, task.id] : prev.filter((id) => id !== task.id),
                    )
                  }
                  label={task.title}
                />
              ))}
            </div>
          </div>
        ) : null}

        <Field label="Qu'as-tu terminé ?">
          <Textarea value={done} onChange={(e) => setDone(e.target.value)} rows={2} />
        </Field>

        <Field label="Qu'est-ce qui reste à faire ?">
          <Textarea value={remaining} onChange={(e) => setRemaining(e.target.value)} rows={2} />
        </Field>

        <Field
          label="Y a-t-il un nouveau blocage ?"
          hint="Renseigné, il marquera la track comme bloquée avec cette raison."
        >
          <Input
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder="Laisser vide si tout va bien"
          />
        </Field>

        <Field label="Quelle est la prochaine action ?">
          <Input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="La première chose à faire la prochaine fois"
          />
        </Field>

        <Field label="Créer une nouvelle tâche ?">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Titre de la tâche à ajouter (facultatif)"
          />
        </Field>
      </div>
    </Modal>
  );
}
