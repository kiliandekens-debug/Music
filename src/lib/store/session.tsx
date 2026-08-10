"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useLocalState } from "@/lib/hooks";
import { useData } from "./data";
import type { WorkSession } from "@/lib/types";

export interface FinishSessionInput {
  doneSummary: string;
  remainingSummary: string;
  blocker: string;
  nextAction: string;
  notes: string;
  /** Tâches cochées comme terminées pendant la session. */
  completedTaskIds: string[];
  /** Nouvelle tâche à créer pour la suite, si l'utilisateur en demande une. */
  newTaskTitle?: string;
}

interface SessionContextValue {
  active: WorkSession | null;
  paused: boolean;
  /** Secondes réellement travaillées (pauses déduites). */
  baseSeconds: number;
  start: (input: { trackId: string; taskIds: string[] }) => Promise<WorkSession>;
  togglePause: () => void;
  finish: (input: FinishSessionInput) => Promise<void>;
  cancel: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { sessions, tasks, insert, update, log, touchTrack } = useData();
  const [pausedAt, setPausedAt] = useLocalState<string | null>("atelier.session.pause", null);

  const active = useMemo(
    () => sessions.find((s) => s.status === "en_cours") ?? null,
    [sessions],
  );

  const paused = Boolean(active && pausedAt);

  /** Secondes écoulées jusqu'au début de la pause en cours, le cas échéant. */
  const baseSeconds = useMemo(() => {
    if (!active?.started_at) return 0;
    if (!pausedAt) return 0;
    const start = new Date(active.started_at).getTime();
    const stop = new Date(pausedAt).getTime();
    return Math.max(0, Math.floor((stop - start) / 1000));
  }, [active, pausedAt]);

  const start = useCallback(
    async ({ trackId, taskIds }: { trackId: string; taskIds: string[] }) => {
      const now = new Date().toISOString();
      const session = await insert("work_sessions", {
        track_id: trackId,
        status: "en_cours",
        started_at: now,
        task_ids: taskIds.slice(0, 3),
      });
      setPausedAt(null);
      touchTrack(trackId);
      return session;
    },
    [insert, setPausedAt, touchTrack],
  );

  /**
   * Pause : on décale l'heure de début à la reprise, afin que la durée
   * enregistrée corresponde toujours au temps réellement travaillé.
   */
  const togglePause = useCallback(() => {
    if (!active) return;
    if (pausedAt) {
      const pausedFor = Date.now() - new Date(pausedAt).getTime();
      const shifted = new Date(
        new Date(active.started_at ?? new Date().toISOString()).getTime() + pausedFor,
      ).toISOString();
      setPausedAt(null);
      void update("work_sessions", active.id, { started_at: shifted });
    } else {
      setPausedAt(new Date().toISOString());
    }
  }, [active, pausedAt, setPausedAt, update]);

  const finish = useCallback(
    async (input: FinishSessionInput) => {
      if (!active) return;
      const endedAt = pausedAt ? new Date(pausedAt) : new Date();
      const startedAt = active.started_at ? new Date(active.started_at) : endedAt;
      const duration = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

      // Progression réellement gagnée : poids des tâches terminées pendant la
      // session, rapporté au poids total des tâches actives de la track.
      const trackTasks = tasks.filter((t) => t.track_id === active.track_id);
      const activeWeight = trackTasks
        .filter((t) => t.status !== "ignoree")
        .reduce((sum, t) => sum + Math.max(1, t.weight), 0);
      const gainedWeight = trackTasks
        .filter((t) => input.completedTaskIds.includes(t.id))
        .reduce((sum, t) => sum + Math.max(1, t.weight), 0);
      const progressGained =
        activeWeight === 0 ? 0 : Math.round((gainedWeight / activeWeight) * 1000) / 10;

      await update("work_sessions", active.id, {
        status: "terminee",
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
        completed_task_ids: input.completedTaskIds,
        done_summary: input.doneSummary || null,
        remaining_summary: input.remainingSummary || null,
        blocker: input.blocker || null,
        next_action: input.nextAction || null,
        notes: input.notes || null,
        progress_gained: progressGained,
      });

      // Le temps de session est réparti sur les tâches travaillées, afin que
      // « durée réellement passée » reflète le travail effectif.
      const worked = active.task_ids ?? [];
      if (worked.length > 0 && duration > 0) {
        const perTask = Math.round(duration / 60 / worked.length);
        for (const taskId of worked) {
          const task = tasks.find((t) => t.id === taskId);
          if (!task) continue;
          await update("track_tasks", taskId, {
            actual_minutes: (task.actual_minutes ?? 0) + perTask,
          });
        }
      }

      if (input.newTaskTitle?.trim() && active.track_id) {
        const maxPosition = trackTasks.reduce((max, t) => Math.max(max, t.position), 0);
        await insert("track_tasks", {
          track_id: active.track_id,
          title: input.newTaskTitle.trim(),
          category: "production",
          position: maxPosition + 1,
        });
      }

      if (input.blocker.trim() && active.track_id) {
        await update("tracks", active.track_id, {
          is_blocked: true,
          blocked_reason: input.blocker.trim(),
        });
      }

      log({
        entity_type: "work_session",
        entity_id: active.id,
        track_id: active.track_id,
        action: "session_terminee",
        summary: `Session de ${Math.round(duration / 60)} min terminée${
          input.doneSummary ? ` — ${input.doneSummary}` : ""
        }`,
        meta: { duration_seconds: duration, progress_gained: progressGained },
      });

      touchTrack(active.track_id);
      setPausedAt(null);
    },
    [active, pausedAt, tasks, update, insert, log, touchTrack, setPausedAt],
  );

  const cancel = useCallback(async () => {
    if (!active) return;
    await update("work_sessions", active.id, {
      status: "annulee",
      ended_at: new Date().toISOString(),
    });
    setPausedAt(null);
  }, [active, update, setPausedAt]);

  const value = useMemo<SessionContextValue>(
    () => ({ active, paused, baseSeconds, start, togglePause, finish, cancel }),
    [active, paused, baseSeconds, start, togglePause, finish, cancel],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession doit être utilisé à l'intérieur de SessionProvider");
  return context;
}
