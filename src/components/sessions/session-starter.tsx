"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import { useSession } from "@/lib/store/session";
import { Button, Checkbox, Field, Select, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PHASE_LABEL } from "@/lib/constants";

const MAX_TASKS = 3;

/**
 * Démarrage d'une session de travail : une track, une à trois tâches.
 * La limite est volontaire — c'est ce qui rend le Mode Session utile.
 */
export function SessionStarter({
  defaultTrackId,
  onStarted,
  onCancel,
}: {
  defaultTrackId?: string;
  onStarted: () => void;
  onCancel?: () => void;
}) {
  const { tracks, tasks } = useData();
  const { inWorkspace } = useUi();
  const { active, start } = useSession();
  const toast = useToast();

  const available = tracks.filter((t) => !t.archived && inWorkspace(t));
  const [trackId, setTrackId] = useState(defaultTrackId ?? available[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const openTasks = tasks
    .filter(
      (t) => t.track_id === trackId && (t.status === "a_faire" || t.status === "en_cours"),
    )
    .sort((a, b) => a.position - b.position);

  if (active) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Une session est déjà en cours. Terminez-la avant d&apos;en démarrer une nouvelle.
        </p>
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Fermer
            </Button>
          ) : null}
          <Link href="/sessions/mode">
            <Button variant="primary">Reprendre la session</Button>
          </Link>
        </div>
      </div>
    );
  }

  function toggle(taskId: string) {
    setSelected((prev) => {
      if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
      if (prev.length >= MAX_TASKS) {
        toast.show(`Trois tâches maximum par session.`);
        return prev;
      }
      return [...prev, taskId];
    });
  }

  async function begin() {
    if (!trackId) {
      toast.error("Choisissez une track.");
      return;
    }
    setBusy(true);
    try {
      await start({ trackId, taskIds: selected });
      onStarted();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Track">
        <Select
          value={trackId}
          onChange={(e) => {
            setTrackId(e.target.value);
            setSelected([]);
          }}
        >
          <option value="">—</option>
          {available.map((track) => (
            <option key={track.id} value={track.id}>
              {track.title}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">
          Tâches de la session · {selected.length}/{MAX_TASKS}
        </p>
        {openTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-faint">
            Aucune tâche ouverte sur cette track. Vous pouvez démarrer sans tâche.
          </p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {openTasks.map((task) => {
              const checked = selected.includes(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggle(task.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-100",
                    checked
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface-2 hover:border-line-strong",
                  )}
                >
                  <span className="pointer-events-none mt-0.5">
                    <Checkbox checked={checked} onChange={() => {}} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{task.title}</span>
                    <span className="text-[11px] text-faint">
                      {PHASE_LABEL[task.phase] ?? task.phase}
                      {task.estimated_minutes ? ` · ${task.estimated_minutes} min estimées` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" loading={busy} onClick={() => void begin()} disabled={!trackId}>
          Démarrer la session
        </Button>
      </div>
    </div>
  );
}
