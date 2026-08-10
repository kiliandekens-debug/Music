"use client";

import { useState } from "react";
import { PHASE_LABEL, PHASES, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Priority, TaskCategory, TaskStatus, TrackTask } from "@/lib/types";

export function TaskForm({
  task,
  trackId: fixedTrackId,
  defaultCategory = "production",
  onDone,
  onCancel,
}: {
  task?: TrackTask;
  trackId?: string;
  defaultCategory?: TaskCategory;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { tracks, tasks, insert, update, touchTrack } = useData();
  const available = tracks.filter((t) => !t.archived);

  const [trackId, setTrackId] = useState(
    task?.track_id ?? fixedTrackId ?? available[0]?.id ?? "",
  );
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? defaultCategory);
  const [phase, setPhase] = useState(task?.phase ?? defaultCategory);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "normale");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "a_faire");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [weight, setWeight] = useState(String(task?.weight ?? 1));
  const [estimated, setEstimated] = useState(
    task?.estimated_minutes !== null && task?.estimated_minutes !== undefined
      ? String(task.estimated_minutes)
      : "",
  );
  const [actual, setActual] = useState(String(task?.actual_minutes ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    if (!trackId) {
      setError("Choisissez une track.");
      return;
    }
    setBusy(true);
    setError(null);

    const values = {
      track_id: trackId,
      title: title.trim(),
      description: description.trim() || null,
      category,
      phase,
      priority,
      status,
      due_date: dueDate || null,
      weight: Math.max(1, Math.min(100, Number(weight) || 1)),
      estimated_minutes: estimated.trim() === "" ? null : Number(estimated),
      actual_minutes: Math.max(0, Number(actual) || 0),
      completed_at:
        status === "terminee"
          ? (task?.completed_at ?? new Date().toISOString())
          : null,
    };

    try {
      if (task) {
        await update("track_tasks", task.id, values);
      } else {
        const position =
          tasks
            .filter((t) => t.track_id === trackId && t.category === category)
            .reduce((max, t) => Math.max(max, t.position), 0) + 1;
        await insert("track_tasks", { ...values, position });
      }
      touchTrack(trackId);
      onDone();
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
      {!fixedTrackId ? (
        <Field label="Track" required>
          <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            <option value="">—</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Titre" required error={error}>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select
            value={category}
            onChange={(e) => {
              const next = e.target.value as TaskCategory;
              setCategory(next);
              setPhase(next === "promotion" ? "promotion" : "production");
            }}
          >
            <option value="production">Production</option>
            <option value="promotion">Promotion</option>
          </Select>
        </Field>
        <Field label="Phase">
          <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priorité">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Statut">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date limite">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Poids dans la progression" hint="1 à 100">
          <Input
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Durée estimée (min)">
          <Input
            type="number"
            min={0}
            value={estimated}
            onChange={(e) => setEstimated(e.target.value)}
          />
        </Field>
        <Field label="Durée réellement passée (min)">
          <Input
            type="number"
            min={0}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {task ? "Enregistrer" : "Ajouter la tâche"}
        </Button>
      </div>
    </form>
  );
}
