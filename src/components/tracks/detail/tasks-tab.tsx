"use client";

import { useMemo, useState } from "react";
import {
  PHASE_LABEL,
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { daysSince, formatDate } from "@/lib/format";
import { computeProgress } from "@/lib/domain/progress";
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
  Modal,
  ProgressBar,
  Select,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus } from "@/components/ui/icons";
import { TaskForm } from "@/components/tasks/task-form";
import { useToast } from "@/components/ui/toast";
import type { TaskCategory, TaskStatus, Track, TrackTask } from "@/lib/types";

export function TasksTab({ track }: { track: Track }) {
  const { tasks, templates, templateItems, insert, insertMany, update, remove, touchTrack, log } =
    useData();
  const toast = useToast();

  const [hideDone, setHideDone] = useState(false);
  const [editing, setEditing] = useState<TrackTask | null>(null);
  const [creating, setCreating] = useState<TaskCategory | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const trackTasks = useMemo(
    () => tasks.filter((t) => t.track_id === track.id),
    [tasks, track.id],
  );

  async function applyTemplate() {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const items = templateItems
      .filter((i) => i.template_id === template.id)
      .sort((a, b) => a.position - b.position);
    if (items.length === 0) {
      toast.error("Ce modèle ne contient aucune tâche.");
      return;
    }
    const base = trackTasks.reduce((max, t) => Math.max(max, t.position), 0);
    await insertMany(
      "track_tasks",
      items.map((item, index) => ({
        track_id: track.id,
        title: item.title,
        description: item.description,
        category: item.category,
        phase: item.phase,
        weight: item.weight,
        estimated_minutes: item.estimated_minutes,
        position: base + index + 1,
      })),
    );
    log({
      entity_type: "track_task",
      track_id: track.id,
      action: "modele_applique",
      summary: `Modèle « ${template.name} » appliqué (${items.length} tâches)`,
    });
    toast.success(`${items.length} tâches ajoutées`);
    setTemplateOpen(false);
    touchTrack(track.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
          Appliquer un modèle
        </Button>
        <Checkbox checked={hideDone} onChange={setHideDone} label="Masquer les tâches terminées" />
      </div>

      <TaskSection
        title="Production"
        category="production"
        tasks={trackTasks.filter((t) => t.category === "production")}
        hideDone={hideDone}
        onAdd={() => setCreating("production")}
        onEdit={setEditing}
        track={track}
      />

      <TaskSection
        title="Promotion"
        category="promotion"
        tasks={trackTasks.filter((t) => t.category === "promotion")}
        hideDone={hideDone}
        onAdd={() => setCreating("promotion")}
        onEdit={setEditing}
        track={track}
      />

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating === "promotion" ? "Nouvelle tâche de promotion" : "Nouvelle tâche"}
      >
        <TaskForm
          trackId={track.id}
          defaultCategory={creating ?? "production"}
          onDone={() => setCreating(null)}
          onCancel={() => setCreating(null)}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier la tâche">
        {editing ? (
          <TaskForm
            task={editing}
            trackId={track.id}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Appliquer un modèle de checklist"
        description="Les tâches du modèle sont ajoutées à celles déjà présentes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTemplateOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!templateId} onClick={() => void applyTemplate()}>
              Ajouter les tâches
            </Button>
          </>
        }
      >
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Choisir un modèle…</option>
          {templates.map((template) => {
            const count = templateItems.filter((i) => i.template_id === template.id).length;
            return (
              <option key={template.id} value={template.id}>
                {template.name} ({count} tâches)
              </option>
            );
          })}
        </Select>
        {templateId ? (
          <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto text-[13px] text-muted">
            {templateItems
              .filter((i) => i.template_id === templateId)
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {PHASE_LABEL[item.phase] ?? item.phase} · poids {item.weight}
                  </span>
                </li>
              ))}
          </ul>
        ) : null}
      </Modal>
    </div>
  );
}

function TaskSection({
  title,
  category,
  tasks,
  hideDone,
  onAdd,
  onEdit,
  track,
}: {
  title: string;
  category: TaskCategory;
  tasks: TrackTask[];
  hideDone: boolean;
  onAdd: () => void;
  onEdit: (task: TrackTask) => void;
  track: Track;
}) {
  const { insert, update, remove, touchTrack } = useData();
  const [quickTitle, setQuickTitle] = useState("");

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => a.position - b.position),
    [tasks],
  );
  const shown = hideDone
    ? sorted.filter((t) => t.status !== "terminee" && t.status !== "ignoree")
    : sorted;
  const progress = computeProgress(tasks);

  async function toggle(task: TrackTask) {
    const done = task.status === "terminee";
    await update("track_tasks", task.id, {
      status: done ? "a_faire" : "terminee",
      completed_at: done ? null : new Date().toISOString(),
    });
    touchTrack(track.id);
  }

  async function setStatus(task: TrackTask, status: TaskStatus) {
    await update("track_tasks", task.id, {
      status,
      completed_at: status === "terminee" ? new Date().toISOString() : null,
    });
    touchTrack(track.id);
  }

  async function move(task: TrackTask, direction: -1 | 1) {
    const index = sorted.findIndex((t) => t.id === task.id);
    const target = sorted[index + direction];
    if (!target) return;
    await update("track_tasks", task.id, { position: target.position });
    await update("track_tasks", target.id, { position: task.position });
  }

  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle("");
    const position = sorted.reduce((max, t) => Math.max(max, t.position), 0) + 1;
    await insert("track_tasks", {
      track_id: track.id,
      title,
      category,
      phase: category === "promotion" ? "promotion" : "production",
      position,
    });
    touchTrack(track.id);
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
          <p className="mt-0.5 text-[12px] text-faint">
            {progress.done}/{progress.total} tâches · poids {progress.doneWeight}/
            {progress.totalWeight}
          </p>
        </div>
        <div className="flex w-full max-w-56 items-center gap-3">
          <ProgressBar
            value={progress.percent}
            tone={category === "promotion" ? "info" : "accent"}
            showValue
            className="flex-1"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="Aucune tâche"
          description={
            category === "promotion"
              ? "Ajoutez les actions de promotion à mener pour cette track."
              : "Ajoutez les étapes de production ou appliquez un modèle."
          }
          className="py-6"
        />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              first={index === 0}
              last={index === shown.length - 1}
              onToggle={() => void toggle(task)}
              onStatus={(status) => void setStatus(task, status)}
              onMove={(direction) => void move(task, direction)}
              onEdit={() => onEdit(task)}
              onDelete={() => void remove("track_tasks", task.id)}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void quickAdd();
            }
          }}
          placeholder="Ajouter une tâche puis Entrée"
          className="h-9 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <IconPlus size={15} />
          Détaillée
        </Button>
      </div>
    </Card>
  );
}

function TaskRow({
  task,
  first,
  last,
  onToggle,
  onStatus,
  onMove,
  onEdit,
  onDelete,
}: {
  task: TrackTask;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onStatus: (status: TaskStatus) => void;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "terminee";
  const overdue =
    !done && task.due_date ? (daysSince(task.due_date) ?? 0) > 0 : false;

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <span className="pt-0.5">
        <Checkbox checked={done} onChange={onToggle} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-snug",
            done ? "text-faint line-through" : "text-ink",
            task.status === "ignoree" && "text-faint line-through",
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 text-[12px] leading-snug text-muted">{task.description}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge>{PHASE_LABEL[task.phase] ?? task.phase}</Badge>
          {task.priority !== "normale" ? (
            <Badge tone={task.priority === "urgente" ? "danger" : "warn"}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          ) : null}
          {task.status === "en_cours" ? <Badge tone="info">En cours</Badge> : null}
          {task.status === "bloquee" ? <Badge tone="danger">Bloquée</Badge> : null}
          {task.due_date ? (
            <Badge tone={overdue ? "danger" : "neutre"}>
              {overdue ? "En retard · " : ""}
              {formatDate(task.due_date, "d MMM")}
            </Badge>
          ) : null}
          {task.weight > 1 ? <Badge>poids {task.weight}</Badge> : null}
          {task.estimated_minutes ? <Badge>{task.estimated_minutes} min</Badge> : null}
          {task.actual_minutes > 0 ? (
            <Badge tone="accent">{task.actual_minutes} min passées</Badge>
          ) : null}
        </div>
      </div>

      <Menu
        trigger={(props) => (
          <IconButton label="Actions" className="opacity-0 group-hover:opacity-100 focus:opacity-100" {...props}>
            <IconMore size={16} />
          </IconButton>
        )}
      >
        <MenuItem onClick={onEdit}>Modifier</MenuItem>
        <MenuSeparator />
        <MenuLabel>Statut</MenuLabel>
        {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((status) => (
          <MenuItem key={status} disabled={task.status === status} onClick={() => onStatus(status)}>
            {TASK_STATUS_LABEL[status]}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem disabled={first} onClick={() => onMove(-1)}>
          Monter
        </MenuItem>
        <MenuItem disabled={last} onClick={() => onMove(1)}>
          Descendre
        </MenuItem>
        <MenuSeparator />
        <MenuItem destructive onClick={onDelete}>
          Supprimer
        </MenuItem>
      </Menu>
    </li>
  );
}
