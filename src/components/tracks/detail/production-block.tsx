"use client";

import { useMemo, useState } from "react";
import { daysSince, formatDate } from "@/lib/format";
import { useData } from "@/lib/store/data";
import {
  Button,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  Modal,
  Select,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { TaskForm } from "@/components/tasks/task-form";
import { NotesField } from "./notes-field";
import { VersionsSection } from "./versions-section";
import { CorrectionsSection } from "./corrections-section";
import type { Track, TrackTask } from "@/lib/types";

/**
 * Tout ce qui fait avancer la musique : la checklist, la prochaine tâche, les
 * notes de travail, les versions audio et les corrections. Ces cinq choses se
 * lisaient auparavant dans cinq onglets ; elles vivent maintenant au même
 * endroit, dans l'ordre où on les utilise.
 */
export function ProductionBlock({ track }: { track: Track }) {
  const { tasks, templates, templateItems, insert, insertMany, update, remove, touchTrack, log } =
    useData();
  const toast = useToast();

  const [editing, setEditing] = useState<TrackTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const checklist = useMemo(
    () =>
      tasks
        .filter((t) => t.track_id === track.id && t.category === "production")
        .sort((a, b) => a.position - b.position),
    [tasks, track.id],
  );

  const open = checklist.filter((t) => t.status === "a_faire" || t.status === "en_cours");
  const nextTask = open.find((t) => t.status === "en_cours") ?? open[0];

  async function toggle(task: TrackTask) {
    const done = task.status === "terminee";
    await update("track_tasks", task.id, {
      status: done ? "a_faire" : "terminee",
      completed_at: done ? null : new Date().toISOString(),
    });
    touchTrack(track.id);
    if (!done) {
      log({
        entity_type: "track_task",
        entity_id: task.id,
        track_id: track.id,
        action: "tache_terminee",
        summary: `« ${task.title} » terminée`,
      });
    }
  }

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
    const base = checklist.reduce((max, t) => Math.max(max, t.position), 0);
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
    touchTrack(track.id);
    toast.success(`${items.length} tâches ajoutées`);
    setTemplateOpen(false);
  }

  return (
    <div className="space-y-6">
      <section>
        <ul className="divide-y divide-line/70">
          {checklist.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              next={task.id === nextTask?.id}
              onToggle={() => void toggle(task)}
              onEdit={() => setEditing(task)}
              onDelete={() => void remove("track_tasks", task.id)}
            />
          ))}
        </ul>

        {checklist.length === 0 ? (
          <p className="py-2 text-sm text-muted">Aucune tâche de production.</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <IconPlus size={15} />
            Ajouter une tâche
          </Button>
          {templates.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setTemplateOpen(true)}>
              Utiliser un modèle
            </Button>
          ) : null}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Notes de travail</h3>
        <NotesField
          trackId={track.id}
          value={track.notes}
          placeholder="Intentions, retours d'écoute, ce qu'il reste à faire…"
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Versions audio</h3>
        <VersionsSection track={track} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Corrections</h3>
        <CorrectionsSection track={track} />
      </section>

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Modifier la tâche" : "Nouvelle tâche"}
      >
        <TaskForm
          task={editing ?? undefined}
          trackId={track.id}
          defaultCategory="production"
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Ajouter les tâches d'un modèle"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTemplateOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!templateId} onClick={() => void applyTemplate()}>
              Ajouter
            </Button>
          </>
        }
      >
        <Select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          aria-label="Modèle"
        >
          <option value="">Choisir un modèle</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}

function TaskRow({
  task,
  next,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TrackTask;
  next?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "terminee";
  const late = task.due_date && !done ? (daysSince(task.due_date) ?? 0) > 0 : false;

  return (
    <li className="group flex items-center gap-3 py-2.5">
      <Checkbox checked={done} onChange={onToggle} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-base",
          done ? "text-muted line-through" : next ? "font-medium text-ink" : "text-ink-soft",
        )}
      >
        {task.title}
      </span>
      {next ? (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-label font-medium text-accent-ink">
          à faire
        </span>
      ) : null}
      {task.due_date && !done ? (
        <span className={cn("shrink-0 text-sm", late ? "text-danger" : "text-muted")}>
          {formatDate(task.due_date, "d MMM")}
        </span>
      ) : null}
      <Menu
        trigger={(props) => (
          <IconButton label="Actions" {...props}>
            <IconMore size={15} />
          </IconButton>
        )}
      >
        <MenuLabel>{task.title}</MenuLabel>
        <MenuItem onClick={onEdit}>Modifier</MenuItem>
        <MenuItem destructive onClick={onDelete}>
          Supprimer
        </MenuItem>
      </Menu>
    </li>
  );
}
