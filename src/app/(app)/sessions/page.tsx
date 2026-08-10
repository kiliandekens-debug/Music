"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useProgressiveList } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import { useSession } from "@/lib/store/session";
import { Badge, Button, Card, EmptyState, Modal, StatTile } from "@/components/ui";
import { IconSession } from "@/components/ui/icons";
import { SessionStarter } from "@/components/sessions/session-starter";

export default function SessionsPage() {
  const router = useRouter();
  const { sessions, tracks, tasks } = useData();
  const { inWorkspace } = useUi();
  const { active } = useSession();
  const [starting, setStarting] = useState(false);

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const visible = useMemo(
    () =>
      sessions
        .filter((session) => {
          if (session.status === "annulee") return false;
          if (!session.track_id) return true;
          const track = trackById.get(session.track_id);
          return track ? inWorkspace(track) : true;
        })
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? "")),
    [sessions, trackById, inWorkspace],
  );

  const stats = useMemo(() => {
    const finished = visible.filter((s) => s.status === "terminee");
    const last30 = finished.filter(
      (s) => s.started_at && new Date(s.started_at) >= subDays(new Date(), 30),
    );
    return {
      total: finished.length,
      time: finished.reduce((sum, s) => sum + s.duration_seconds, 0),
      month: last30.length,
      monthTime: last30.reduce((sum, s) => sum + s.duration_seconds, 0),
    };
  }, [visible]);

  const [shown, hasMore, showMore] = useProgressiveList(visible, 25);

  return (
    <div className="px-4 py-5 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Sessions" value={stats.total} />
          <StatTile label="Temps total" value={formatDuration(stats.time)} />
          <StatTile label="30 derniers jours" value={stats.month} />
          <StatTile label="Temps sur 30 jours" value={formatDuration(stats.monthTime)} />
        </div>
      </div>

      <div className="mb-4">
        {active ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/30 p-4">
            <div>
              <p className="text-[13px] font-medium text-ink">Session en cours</p>
              <p className="text-[12px] text-muted">
                {trackById.get(active.track_id ?? "")?.title ?? "Session libre"} · démarrée{" "}
                {formatDateTime(active.started_at)}
              </p>
            </div>
            <Link href="/sessions/mode">
              <Button variant="primary">Reprendre</Button>
            </Link>
          </Card>
        ) : (
          <Button variant="primary" onClick={() => setStarting(true)}>
            <IconSession size={16} />
            Démarrer une session
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconSession size={28} />}
          title="Aucune session enregistrée"
          description="Le Mode Session mesure le temps réellement passé et note ce qui a avancé."
          action={
            <Button variant="primary" onClick={() => setStarting(true)}>
              Démarrer la première
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((session) => {
              const track = session.track_id ? trackById.get(session.track_id) : undefined;
              const done = session.completed_task_ids ?? [];
              return (
                <Card key={session.id} className="p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {track ? (
                        <Link
                          href={`/studio/${track.id}?onglet=sessions`}
                          className="truncate text-[13px] font-medium text-ink hover:text-accent-ink"
                        >
                          {track.title}
                        </Link>
                      ) : (
                        <span className="text-[13px] font-medium text-ink">Session libre</span>
                      )}
                      <p className="text-[12px] text-muted">{formatDateTime(session.started_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === "en_cours" ? (
                        <Badge tone="accent">En cours</Badge>
                      ) : (
                        <Badge>{formatDuration(session.duration_seconds)}</Badge>
                      )}
                      {session.progress_gained > 0 ? (
                        <Badge tone="ok">+{session.progress_gained} %</Badge>
                      ) : null}
                    </div>
                  </div>

                  {done.length > 0 ? (
                    <p className="mt-1.5 text-[12px] text-muted">
                      {done.length} tâche
                      {done.length > 1 ? "s" : ""} terminée
                      {done.length > 1 ? "s" : ""} :{" "}
                      {done
                        .map((id) => tasks.find((t) => t.id === id)?.title)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}

                  {session.next_action ? (
                    <p className="mt-1.5 text-[12px] text-accent-ink">
                      Prochaine action : {session.next_action}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>

          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={showMore}>
                Afficher plus
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Modal open={starting} onClose={() => setStarting(false)} title="Démarrer une session">
        <SessionStarter
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
