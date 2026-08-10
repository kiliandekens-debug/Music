"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useData } from "@/lib/store/data";
import { Badge, Button, Card, EmptyState, Modal, StatTile } from "@/components/ui";
import { IconSession } from "@/components/ui/icons";
import { SessionStarter } from "@/components/sessions/session-starter";
import type { Track } from "@/lib/types";

/** Historique des sessions de travail sur cette track. */
export function SessionsTab({ track }: { track: Track }) {
  const router = useRouter();
  const { sessions, tasks } = useData();
  const [starting, setStarting] = useState(false);

  const trackSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.track_id === track.id && s.status !== "annulee")
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? "")),
    [sessions, track.id],
  );

  const finished = trackSessions.filter((s) => s.status === "terminee");
  const totalSeconds = finished.reduce((sum, s) => sum + s.duration_seconds, 0);
  const average = finished.length > 0 ? totalSeconds / finished.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <StatTile label="Sessions" value={finished.length} />
          <StatTile label="Temps total" value={formatDuration(totalSeconds)} />
          <StatTile label="Durée moyenne" value={formatDuration(average)} />
        </div>
      </div>

      <Button variant="primary" size="sm" onClick={() => setStarting(true)}>
        <IconSession size={16} />
        Démarrer une session
      </Button>

      {trackSessions.length === 0 ? (
        <EmptyState
          icon={<IconSession size={26} />}
          title="Aucune session"
          description="Le Mode Session enregistre le temps passé, ce qui a avancé et la prochaine action."
        />
      ) : (
        <div className="space-y-2">
          {trackSessions.map((session) => (
            <Card key={session.id} className="p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">
                    {formatDateTime(session.started_at)}
                  </span>
                  {session.status === "en_cours" ? (
                    <Badge tone="accent">En cours</Badge>
                  ) : (
                    <Badge>{formatDuration(session.duration_seconds)}</Badge>
                  )}
                  {session.progress_gained > 0 ? (
                    <Badge tone="ok">+{session.progress_gained} % de progression</Badge>
                  ) : null}
                </div>
              </div>

              {(session.task_ids ?? []).length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {(session.task_ids ?? []).map((taskId) => {
                    const task = tasks.find((t) => t.id === taskId);
                    const done = (session.completed_task_ids ?? []).includes(taskId);
                    return (
                      <li key={taskId} className="text-[12px] text-muted">
                        {done ? "✓" : "•"} {task?.title ?? "Tâche supprimée"}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <dl className="mt-2 space-y-1.5 text-[12px]">
                {session.done_summary ? (
                  <div>
                    <dt className="inline text-faint">Terminé : </dt>
                    <dd className="inline text-ink-soft">{session.done_summary}</dd>
                  </div>
                ) : null}
                {session.remaining_summary ? (
                  <div>
                    <dt className="inline text-faint">Reste à faire : </dt>
                    <dd className="inline text-ink-soft">{session.remaining_summary}</dd>
                  </div>
                ) : null}
                {session.blocker ? (
                  <div>
                    <dt className="inline text-faint">Blocage : </dt>
                    <dd className="inline text-danger">{session.blocker}</dd>
                  </div>
                ) : null}
                {session.next_action ? (
                  <div>
                    <dt className="inline text-faint">Prochaine action : </dt>
                    <dd className="inline text-accent-ink">{session.next_action}</dd>
                  </div>
                ) : null}
                {session.notes ? (
                  <p className="mt-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 leading-snug text-ink-soft">
                    {session.notes}
                  </p>
                ) : null}
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal open={starting} onClose={() => setStarting(false)} title="Démarrer une session">
        <SessionStarter
          defaultTrackId={track.id}
          onStarted={() => {
            setStarting(false);
            router.push("/sessions/mode");
          }}
          onCancel={() => setStarting(false)}
        />
      </Modal>
    </div>
  );
}
