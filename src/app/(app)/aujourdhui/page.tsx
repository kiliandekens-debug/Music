"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startOfWeek } from "date-fns";
import { RULE_LABEL } from "@/lib/domain/next-action";
import { submissionTiming } from "@/lib/domain/submissions";
import {
  daysSince,
  daysUntil,
  formatDate,
  formatDateLong,
  formatDuration,
  relativeDayLabel,
} from "@/lib/format";
import { useLocalState } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { useSession } from "@/lib/store/session";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Modal,
  SectionTitle,
  StatTile,
  cn,
} from "@/components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconPlus,
  IconSession,
  IconSparks,
} from "@/components/ui/icons";
import { SessionStarter } from "@/components/sessions/session-starter";
import { RespondedDialog } from "@/components/labels/responded-dialog";
import type { LabelSubmission } from "@/lib/types";

export default function TodayPage() {
  const router = useRouter();
  const { profile, tasks, promoTasks, submissions, labels, sessions, update, touchTrack } = useData();
  const { suggestions, dueFollowups, inactiveTracks, visibleTracks, trackById, inactivityDays } =
    useDerived();
  const { openQuickAdd, inWorkspace } = useUi();
  const { active } = useSession();

  const [pinned, setPinned] = useLocalState<string | null>("atelier.action.epinglee", null);
  const [starting, setStarting] = useState(false);
  const [responding, setResponding] = useState<LabelSubmission | null>(null);

  const today = new Date();

  // --- Prochaine action -----------------------------------------------------
  const pinnedSuggestion = pinned ? suggestions.find((s) => s.id === pinned) : undefined;
  const primary = pinnedSuggestion ?? suggestions[0];
  const alternatives = suggestions.filter((s) => s.id !== primary?.id).slice(0, 4);

  // --- Listes ---------------------------------------------------------------
  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (task.status !== "a_faire" && task.status !== "en_cours") return false;
          if (!task.due_date) return false;
          const track = trackById.get(task.track_id);
          if (!track || track.archived || !inWorkspace(track)) return false;
          return (daysSince(task.due_date) ?? 0) > 0;
        })
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [tasks, trackById, inWorkspace],
  );

  const todayPromoTasks = useMemo(
    () =>
      promoTasks
        .filter((task) => {
          if (task.status !== "a_faire" && task.status !== "en_cours") return false;
          if (!task.due_date) return false;
          const track = trackById.get(task.track_id);
          if (!track || track.archived || !inWorkspace(track)) return false;
          const until = daysUntil(task.due_date) ?? 0;
          return until <= 0;
        })
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [promoTasks, trackById, inWorkspace],
  );

  const recentResponses = useMemo(
    () =>
      submissions
        .filter((s) => {
          if (!s.responded_at) return false;
          const track = trackById.get(s.track_id);
          if (!track || !inWorkspace(track)) return false;
          return (daysSince(s.responded_at) ?? 999) <= 14;
        })
        .sort((a, b) => (b.responded_at ?? "").localeCompare(a.responded_at ?? "")),
    [submissions, trackById, inWorkspace],
  );

  const upcomingReleases = useMemo(
    () =>
      visibleTracks
        .filter((track) => {
          if (!track.release_date) return false;
          const until = daysUntil(track.release_date) ?? -999;
          return until >= -3 && until <= 60;
        })
        .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? "")),
    [visibleTracks],
  );

  // --- Progression hebdomadaire ---------------------------------------------
  const week = useMemo(() => {
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const weekSessions = sessions.filter(
      (s) =>
        s.status === "terminee" &&
        s.started_at &&
        new Date(s.started_at) >= monday &&
        (s.track_id ? inWorkspace(trackById.get(s.track_id) ?? { workspace_id: null }) : true),
    );
    const completedTasks = tasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= monday,
    );
    const completedPromo = promoTasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= monday,
    );
    const sent = submissions.filter(
      (s) => s.sent_at && new Date(`${s.sent_at}T00:00:00`) >= monday,
    );
    return {
      sessions: weekSessions.length,
      time: weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0),
      tasks: completedTasks.length + completedPromo.length,
      submissions: sent.length,
    };
  }, [sessions, tasks, promoTasks, submissions, today, inWorkspace, trackById]);

  async function completeTask(taskId: string, table: "track_tasks" | "promotion_tasks") {
    const trackId =
      table === "track_tasks"
        ? tasks.find((t) => t.id === taskId)?.track_id
        : promoTasks.find((t) => t.id === taskId)?.track_id;
    await update(table, taskId, {
      status: "terminee",
      completed_at: new Date().toISOString(),
    });
    touchTrack(trackId);
  }

  return (
    <div className="px-4 py-5 lg:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting()}
            {profile?.display_name ? `, ${profile.display_name}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] capitalize text-muted">{formatDateLong(today)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStarting(true)}>
            <IconSession size={16} />
            {active ? "Reprendre la session" : "Session rapide"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => openQuickAdd()}>
            <IconPlus size={16} />
            Ajouter
          </Button>
        </div>
      </header>

      {/* Prochaine action recommandée */}
      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              <IconSparks size={15} className="text-accent" />
              Voici ce que tu devrais faire maintenant
            </h2>
            {pinnedSuggestion ? (
              <Button size="sm" variant="ghost" onClick={() => setPinned(null)}>
                Rendre la main au moteur
              </Button>
            ) : null}
          </div>
        </div>

        {primary ? (
          <div className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Badge
                  tone={
                    primary.tone === "danger"
                      ? "danger"
                      : primary.tone === "warn"
                        ? "warn"
                        : primary.tone === "ok"
                          ? "ok"
                          : "info"
                  }
                >
                  {RULE_LABEL[primary.rule]}
                </Badge>
                <p className="mt-2 text-[15px] font-medium leading-snug text-ink">
                  {primary.title}
                </p>
                <p className="mt-1 text-[13px] text-muted">{primary.reason}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {primary.taskId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void completeTask(primary.taskId!, "track_tasks")}
                  >
                    <IconCheck size={15} />
                    Terminée
                  </Button>
                ) : null}
                {primary.promoTaskId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void completeTask(primary.promoTaskId!, "promotion_tasks")}
                  >
                    <IconCheck size={15} />
                    Terminée
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => router.push(primary.href)}>
                  Ouvrir
                  <IconArrowRight size={15} />
                </Button>
              </div>
            </div>

            {alternatives.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-faint">
                  Autres priorités possibles
                </p>
                <ul className="space-y-1">
                  {alternatives.map((suggestion) => (
                    <li key={suggestion.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPinned(suggestion.id)}
                        className="min-w-0 flex-1 truncate text-left text-[13px] text-ink-soft hover:text-accent-ink"
                        title="Choisir cette action à la place"
                      >
                        {suggestion.title}
                      </button>
                      <span className="shrink-0 text-[11px] text-faint">
                        {RULE_LABEL[suggestion.rule]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-[13px] text-muted">
              Rien d&apos;urgent. Démarrez une session sur la track qui vous tente, ou créez une
              nouvelle idée.
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Relances labels */}
        <section>
          <SectionTitle title="Relances à effectuer" count={dueFollowups.length} className="mb-2" />
          {dueFollowups.length === 0 ? (
            <EmptyState title="Aucune relance prévue" className="py-6" />
          ) : (
            <div className="space-y-2">
              {dueFollowups.slice(0, 6).map((submission) => {
                const label = labels.find((l) => l.id === submission.label_id);
                const track = trackById.get(submission.track_id);
                const timing = submissionTiming(submission);
                return (
                  <Card key={submission.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">
                        {label?.name ?? "Label"} — {track?.title ?? "Track"}
                      </p>
                      <p
                        className={cn(
                          "text-[12px]",
                          timing.tone === "danger" ? "text-danger" : "text-warn",
                        )}
                      >
                        {timing.label}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setResponding(submission)}>
                      Répondu
                    </Button>
                    <Link href={`/labels?envoi=${submission.id}`}>
                      <Button size="sm" variant="ghost">
                        Ouvrir
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Tâches en retard */}
        <section>
          <SectionTitle title="Tâches en retard" count={overdueTasks.length} className="mb-2" />
          {overdueTasks.length === 0 ? (
            <EmptyState title="Rien en retard" className="py-6" />
          ) : (
            <div className="space-y-2">
              {overdueTasks.slice(0, 6).map((task) => {
                const track = trackById.get(task.track_id);
                return (
                  <Card key={task.id} className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={false}
                      onChange={() => void completeTask(task.id, "track_tasks")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">{task.title}</p>
                      <p className="text-[12px] text-danger">
                        {track?.title} · échéance {relativeDayLabel(task.due_date)}
                      </p>
                    </div>
                    <Link href={`/studio/${task.track_id}?onglet=taches`}>
                      <Button size="sm" variant="ghost">
                        Ouvrir
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Tâches promo du jour */}
        <section>
          <SectionTitle
            title="Promotion du jour"
            count={todayPromoTasks.length}
            className="mb-2"
          />
          {todayPromoTasks.length === 0 ? (
            <EmptyState title="Aucune tâche promo aujourd'hui" className="py-6" />
          ) : (
            <div className="space-y-2">
              {todayPromoTasks.slice(0, 6).map((task) => {
                const track = trackById.get(task.track_id);
                return (
                  <Card key={task.id} className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={false}
                      onChange={() => void completeTask(task.id, "promotion_tasks")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">{task.title}</p>
                      <p className="text-[12px] text-muted">
                        {track?.title} · {task.group_key}
                      </p>
                    </div>
                    <Link href={`/studio/${task.track_id}?onglet=promotion`}>
                      <Button size="sm" variant="ghost">
                        Ouvrir
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Réponses récentes */}
        <section>
          <SectionTitle
            title="Réponses reçues récemment"
            count={recentResponses.length}
            className="mb-2"
          />
          {recentResponses.length === 0 ? (
            <EmptyState title="Aucune réponse ces 14 derniers jours" className="py-6" />
          ) : (
            <div className="space-y-2">
              {recentResponses.slice(0, 5).map((submission) => {
                const label = labels.find((l) => l.id === submission.label_id);
                const track = trackById.get(submission.track_id);
                return (
                  <Card key={submission.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] text-ink">
                        {label?.name} — {track?.title}
                      </p>
                      <Badge
                        tone={
                          submission.response_type === "negative"
                            ? "neutre"
                            : submission.response_type === "positive"
                              ? "ok"
                              : "info"
                        }
                      >
                        {formatDate(submission.responded_at, "d MMM")}
                      </Badge>
                    </div>
                    {submission.response_message ? (
                      <p className="mt-1 line-clamp-2-safe text-[12px] text-muted">
                        {submission.response_message}
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Sorties à venir */}
        <section>
          <SectionTitle title="Sorties à venir" count={upcomingReleases.length} className="mb-2" />
          {upcomingReleases.length === 0 ? (
            <EmptyState title="Aucune sortie planifiée" className="py-6" />
          ) : (
            <div className="space-y-2">
              {upcomingReleases.map((track) => {
                const until = daysUntil(track.release_date) ?? 0;
                return (
                  <Card key={track.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/studio/${track.id}?onglet=promotion`}
                        className="truncate text-[13px] text-ink hover:text-accent-ink"
                      >
                        {track.title}
                      </Link>
                      <p className="text-[12px] text-muted">
                        {formatDate(track.release_date)} · {relativeDayLabel(track.release_date)}
                      </p>
                    </div>
                    <Badge tone={until <= 7 ? "warn" : "info"}>
                      {until >= 0 ? `J−${until}` : `J+${Math.abs(until)}`}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Tracks sans activité */}
        <section>
          <SectionTitle
            title={`Sans activité depuis ${inactivityDays} jours`}
            count={inactiveTracks.length}
            className="mb-2"
          />
          {inactiveTracks.length === 0 ? (
            <EmptyState title="Tout est actif" className="py-6" />
          ) : (
            <div className="space-y-2">
              {inactiveTracks.slice(0, 6).map((track) => (
                <Card key={track.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/studio/${track.id}`}
                      className="truncate text-[13px] text-ink hover:text-accent-ink"
                    >
                      {track.title}
                    </Link>
                    <p className="text-[12px] text-muted">
                      Dernière activité {relativeDayLabel(track.last_activity_at)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setStarting(true)}>
                    Reprendre
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Progression hebdomadaire */}
      <section className="mt-6">
        <SectionTitle title="Cette semaine" className="mb-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Sessions" value={week.sessions} />
          <StatTile label="Temps travaillé" value={formatDuration(week.time)} />
          <StatTile label="Tâches terminées" value={week.tasks} />
          <StatTile label="Envois labels" value={week.submissions} />
        </div>
      </section>

      <Modal open={starting} onClose={() => setStarting(false)} title="Session rapide">
        <SessionStarter
          onStarted={() => {
            setStarting(false);
            router.push("/sessions/mode");
          }}
          onCancel={() => setStarting(false)}
        />
      </Modal>

      <RespondedDialog
        submission={responding}
        open={responding !== null}
        onClose={() => setResponding(null)}
      />
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}
