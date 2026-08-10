"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { PHASE_LABEL } from "@/lib/constants";
import { computeSubmissionStats } from "@/lib/domain/submissions";
import { daysSince, formatDuration, formatMoney, formatNumber, plural } from "@/lib/format";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { useUi } from "@/lib/store/ui";
import { Badge, Card, EmptyState, SectionTitle, Select, StatTile, Tabs } from "@/components/ui";
import { IconChart } from "@/components/ui/icons";

type Period = "30" | "90" | "365" | "tout";

const PERIOD_LABEL: Record<Period, string> = {
  "30": "30 derniers jours",
  "90": "90 derniers jours",
  "365": "12 derniers mois",
  tout: "Depuis le début",
};

export default function AnalysesPage() {
  const data = useData();
  const { workspaceById, stageById, progressByTrack, inactivityDays } = useDerived();
  const { inWorkspace } = useUi();

  const [tab, setTab] = useState("production");
  const [period, setPeriod] = useState<Period>("90");
  const [genre, setGenre] = useState("tous");

  const since = useMemo(() => {
    if (period === "tout") return new Date(0);
    return subDays(new Date(), Number(period));
  }, [period]);

  const genres = useMemo(
    () =>
      [...new Set(data.tracks.map((t) => t.genre).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "fr"),
      ) as string[],
    [data.tracks],
  );

  /** Tracks retenues : espace sélectionné + filtre de genre. La période
   *  s'applique aux évènements, pas à l'existence de la track. */
  const scopeTracks = useMemo(
    () =>
      data.tracks.filter(
        (track) => inWorkspace(track) && (genre === "tous" || track.genre === genre),
      ),
    [data.tracks, inWorkspace, genre],
  );
  const scopeIds = useMemo(() => new Set(scopeTracks.map((t) => t.id)), [scopeTracks]);

  return (
    <div className="px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="w-auto"
          aria-label="Période"
        >
          {(Object.keys(PERIOD_LABEL) as Period[]).map((value) => (
            <option key={value} value={value}>
              {PERIOD_LABEL[value]}
            </option>
          ))}
        </Select>
        <Select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-auto"
          aria-label="Genre"
        >
          <option value="tous">Tous les genres</option>
          {genres.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <p className="text-[12px] text-faint">
          L&apos;espace sélectionné dans la barre supérieure s&apos;applique aussi ici.
        </p>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { id: "production", label: "Production" },
          { id: "labels", label: "Labels" },
          { id: "promotion", label: "Promotion" },
        ]}
      />

      {tab === "production" ? (
        <ProductionAnalytics
          since={since}
          scopeTracks={scopeTracks}
          scopeIds={scopeIds}
          inactivityDays={inactivityDays}
          progressByTrack={progressByTrack}
          stageName={(id) => (id ? (stageById.get(id)?.name ?? "—") : "Sans étape")}
        />
      ) : null}

      {tab === "labels" ? <LabelAnalytics since={since} scopeIds={scopeIds} /> : null}

      {tab === "promotion" ? <PromotionAnalytics since={since} scopeIds={scopeIds} /> : null}
    </div>
  );
}

// --- Production --------------------------------------------------------------

function ProductionAnalytics({
  since,
  scopeTracks,
  scopeIds,
  inactivityDays,
  progressByTrack,
  stageName,
}: {
  since: Date;
  scopeTracks: ReturnType<typeof useData>["tracks"];
  scopeIds: Set<string>;
  inactivityDays: number;
  progressByTrack: ReturnType<typeof useDerived>["progressByTrack"];
  stageName: (id: string | null) => string;
}) {
  const { tasks, sessions } = useData();

  const stats = useMemo(() => {
    const created = scopeTracks.filter((t) => new Date(t.created_at) >= since);

    // « Terminée » = toutes les tâches de production actives sont faites.
    const finished = scopeTracks.filter((track) => {
      const progress = progressByTrack.get(track.id);
      return progress && progress.production.total > 0 && progress.production.percent >= 100;
    });

    const finishedInPeriod = finished.filter((track) => {
      const last = tasks
        .filter((t) => t.track_id === track.id && t.category === "production" && t.completed_at)
        .map((t) => t.completed_at as string)
        .sort();
      const at = last[last.length - 1];
      return at ? new Date(at) >= since : false;
    });

    // Durée de production : de la création à la dernière tâche terminée.
    const durations: number[] = [];
    for (const track of finished) {
      const completions = tasks
        .filter((t) => t.track_id === track.id && t.category === "production" && t.completed_at)
        .map((t) => new Date(t.completed_at as string).getTime())
        .sort((a, b) => a - b);
      const end = completions[completions.length - 1];
      if (!end) continue;
      const days = Math.round((end - new Date(track.created_at).getTime()) / 86_400_000);
      if (days >= 0) durations.push(days);
    }

    const scopeSessions = sessions.filter(
      (s) =>
        s.status === "terminee" &&
        s.started_at &&
        new Date(s.started_at) >= since &&
        (s.track_id ? scopeIds.has(s.track_id) : false),
    );

    // Temps par phase : minutes réellement enregistrées sur les tâches.
    const byPhase = new Map<string, number>();
    for (const task of tasks) {
      if (!scopeIds.has(task.track_id)) continue;
      if (task.actual_minutes <= 0) continue;
      byPhase.set(task.phase, (byPhase.get(task.phase) ?? 0) + task.actual_minutes);
    }

    // Où les tracks stagnent : nombre de tracks inactives par étape.
    const stuck = new Map<string, number>();
    for (const track of scopeTracks) {
      if (track.archived) continue;
      const idle = daysSince(track.last_activity_at) ?? 0;
      if (idle < inactivityDays) continue;
      const key = stageName(track.stage_id);
      stuck.set(key, (stuck.get(key) ?? 0) + 1);
    }

    const activeTracks = scopeTracks.filter((t) => !t.archived);
    const averageProgress =
      activeTracks.length === 0
        ? 0
        : activeTracks.reduce(
            (sum, t) => sum + (progressByTrack.get(t.id)?.production.percent ?? 0),
            0,
          ) / activeTracks.length;

    return {
      created: created.length,
      finished: finishedInPeriod.length,
      finishedTotal: finished.length,
      completionRate: created.length === 0 ? null : (finishedInPeriod.length / created.length) * 100,
      averageDuration:
        durations.length === 0
          ? null
          : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      sessions: scopeSessions.length,
      totalTime: scopeSessions.reduce((sum, s) => sum + s.duration_seconds, 0),
      inactive: activeTracks.filter(
        (t) => (daysSince(t.last_activity_at) ?? 0) >= inactivityDays,
      ).length,
      averageProgress,
      byPhase: [...byPhase.entries()]
        .map(([phase, minutes]) => ({
          phase: PHASE_LABEL[phase] ?? phase,
          heures: Math.round((minutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.heures - a.heures),
      stuck: [...stuck.entries()]
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count),
    };
  }, [scopeTracks, scopeIds, since, tasks, sessions, progressByTrack, inactivityDays, stageName]);

  const monthly = useMemo(() => {
    const months: { mois: string; créées: number; terminées: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = subMonths(new Date(), i);
      const key = format(date, "yyyy-MM");
      const created = scopeTracks.filter((t) => t.created_at.slice(0, 7) === key).length;
      const finished = tasks.filter(
        (t) =>
          scopeIds.has(t.track_id) &&
          t.category === "production" &&
          t.completed_at?.slice(0, 7) === key,
      ).length;
      months.push({
        mois: format(date, "MMM", { locale: fr }),
        créées: created,
        terminées: finished,
      });
    }
    return months;
  }, [scopeTracks, scopeIds, tasks]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Tracks créées" value={stats.created} />
        <StatTile label="Tracks terminées" value={stats.finished} />
        <StatTile
          label="Taux de finalisation"
          value={stats.completionRate === null ? "—" : `${Math.round(stats.completionRate)} %`}
        />
        <StatTile
          label="Durée moyenne"
          value={stats.averageDuration === null ? "—" : plural(stats.averageDuration, "jour")}
        />
        <StatTile label="Sessions" value={stats.sessions} />
        <StatTile label="Temps total travaillé" value={formatDuration(stats.totalTime)} />
        <StatTile
          label="Progression moyenne"
          value={`${Math.round(stats.averageProgress)} %`}
        />
        <StatTile
          label="Tracks sans activité"
          value={stats.inactive}
          tone={stats.inactive > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Temps passé par phase" className="mb-3" />
          {stats.byPhase.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-faint">
              Aucune durée enregistrée. Le temps se remplit en terminant des sessions.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byPhase} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="phase"
                    stroke="var(--color-faint)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-faint)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-surface-2)" }}
                    contentStyle={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value} h`, "Temps"]}
                  />
                  <Bar dataKey="heures" radius={[4, 4, 0, 0]} fill="var(--accent)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Activité sur 6 mois" className="mb-3" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="mois"
                  stroke="var(--color-faint)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-faint)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="créées"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="terminées"
                  stroke="var(--color-ok)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            « Terminées » compte les tâches de production achevées chaque mois.
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle title="Où les tracks stagnent" className="mb-3" />
        {stats.stuck.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">
            Aucune track inactive : rien ne stagne.
          </p>
        ) : (
          <ul className="space-y-2">
            {stats.stuck.map((item) => (
              <li key={item.stage} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[13px] text-ink-soft">
                  {item.stage}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-warn"
                    style={{
                      width: `${(item.count / stats.stuck[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="tabular w-8 shrink-0 text-right text-[12px] text-muted">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --- Labels ------------------------------------------------------------------

function LabelAnalytics({ since, scopeIds }: { since: Date; scopeIds: Set<string> }) {
  const { labels, submissions } = useData();

  const scoped = useMemo(
    () =>
      submissions.filter((submission) => {
        if (!scopeIds.has(submission.track_id)) return false;
        const reference = submission.sent_at ?? submission.created_at;
        return new Date(reference) >= since;
      }),
    [submissions, scopeIds, since],
  );

  const stats = useMemo(() => computeSubmissionStats(scoped), [scoped]);

  const perLabel = useMemo(() => {
    const map = new Map<string, typeof scoped>();
    for (const submission of scoped) {
      const list = map.get(submission.label_id);
      if (list) list.push(submission);
      else map.set(submission.label_id, [submission]);
    }
    return [...map.entries()]
      .map(([labelId, list]) => ({
        label: labels.find((l) => l.id === labelId),
        stats: computeSubmissionStats(list),
      }))
      .filter((row) => row.label);
  }, [scoped, labels]);

  const mostReactive = useMemo(
    () =>
      perLabel
        .filter((row) => row.stats.responded > 0 && row.stats.averageResponseDays !== null)
        .sort(
          (a, b) =>
            (a.stats.averageResponseDays ?? 999) - (b.stats.averageResponseDays ?? 999) ||
            b.stats.responseRate - a.stats.responseRate,
        )
        .slice(0, 6),
    [perLabel],
  );

  const silent = useMemo(
    () =>
      perLabel
        .filter((row) => row.stats.sent > 0 && row.stats.responded === 0)
        .sort((a, b) => b.stats.sent - a.stats.sent)
        .slice(0, 8),
    [perLabel],
  );

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={<IconChart size={28} />}
        title="Aucun envoi sur cette période"
        description="Les statistiques apparaissent dès le premier envoi enregistré."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Labels enregistrés" value={labels.filter((l) => !l.archived).length} />
        <StatTile label="Envois" value={stats.sent} />
        <StatTile label="Taux de réponse" value={`${Math.round(stats.responseRate)} %`} />
        <StatTile
          label="Délai moyen de réponse"
          value={
            stats.averageResponseDays === null
              ? "—"
              : plural(Math.round(stats.averageResponseDays), "jour")
          }
        />
        <StatTile label="Réponses positives" value={stats.positive} tone="ok" />
        <StatTile label="Refus" value={stats.negative} />
        <StatTile label="Signatures" value={stats.signed} tone="ok" />
        <StatTile
          label="Relances en retard"
          value={stats.overdueFollowups}
          tone={stats.overdueFollowups > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Labels les plus réactifs" className="mb-3" />
          {mostReactive.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-faint">
              Aucune réponse enregistrée sur cette période.
            </p>
          ) : (
            <ul className="space-y-2">
              {mostReactive.map((row) => (
                <li key={row.label!.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/labels?label=${row.label!.id}`}
                    className="truncate text-[13px] text-ink hover:text-accent-ink"
                  >
                    {row.label!.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="ok">
                      {plural(Math.round(row.stats.averageResponseDays ?? 0), "jour")}
                    </Badge>
                    <span className="tabular text-[12px] text-muted">
                      {Math.round(row.stats.responseRate)} %
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Labels sans réponse" className="mb-3" />
          {silent.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-faint">
              Tous les labels contactés ont répondu.
            </p>
          ) : (
            <ul className="space-y-2">
              {silent.map((row) => (
                <li key={row.label!.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/labels?label=${row.label!.id}`}
                    className="truncate text-[13px] text-ink hover:text-accent-ink"
                  >
                    {row.label!.name}
                  </Link>
                  <span className="shrink-0 text-[12px] text-muted">
                    {plural(row.stats.sent, "envoi")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Promotion ---------------------------------------------------------------

function PromotionAnalytics({ since, scopeIds }: { since: Date; scopeIds: Set<string> }) {
  const { campaigns, promoTasks, content, contacts, outreach, metrics, tracks } = useData();

  const stats = useMemo(() => {
    const scopedCampaigns = campaigns.filter((c) => scopeIds.has(c.track_id));
    const active = scopedCampaigns.filter(
      (c) => c.status !== "terminee" && c.status !== "a_preparer",
    );

    const scopedTasks = promoTasks.filter((t) => scopeIds.has(t.track_id));
    const completed = scopedTasks.filter(
      (t) => t.status === "terminee" && t.completed_at && new Date(t.completed_at) >= since,
    );
    const onTime = completed.filter(
      (t) => !t.due_date || (t.completed_at ?? "").slice(0, 10) <= t.due_date,
    );

    const published = content.filter(
      (item) =>
        item.status === "publie" &&
        (item.track_id ? scopeIds.has(item.track_id) : true) &&
        item.scheduled_at &&
        new Date(item.scheduled_at) >= since,
    );

    const scopedOutreach = outreach.filter(
      (item) =>
        scopeIds.has(item.track_id) && item.sent_at && new Date(item.sent_at) >= since,
    );
    const supports = scopedOutreach.filter(
      (item) => item.responded_at && item.support_type !== "aucun",
    );

    const scopedMetrics = metrics.filter((m) => scopeIds.has(m.track_id));
    const spend = scopedMetrics.reduce(
      (sum, m) => sum + (m.ad_spend ?? 0) + (m.other_spend ?? 0),
      0,
    );
    const revenue = scopedMetrics.reduce((sum, m) => sum + (m.revenue ?? 0), 0);

    // Dernier relevé par track, pour comparer les sorties entre elles.
    const latestByTrack = new Map<string, (typeof metrics)[number]>();
    for (const metric of scopedMetrics) {
      const current = latestByTrack.get(metric.track_id);
      if (!current || metric.measured_on > current.measured_on) {
        latestByTrack.set(metric.track_id, metric);
      }
    }

    return {
      campaigns: scopedCampaigns.length,
      active: active.length,
      completed: completed.length,
      onTimeRate: completed.length === 0 ? null : (onTime.length / completed.length) * 100,
      published: published.length,
      contacts: contacts.filter((c) => !c.archived).length,
      outreach: scopedOutreach.length,
      supports: supports.length,
      spend,
      revenue,
      perRelease: [...latestByTrack.entries()]
        .map(([trackId, metric]) => ({
          track: tracks.find((t) => t.id === trackId),
          metric,
        }))
        .filter((row) => row.track)
        .sort(
          (a, b) => (b.metric.spotify_streams ?? 0) - (a.metric.spotify_streams ?? 0),
        )
        .slice(0, 8),
    };
  }, [campaigns, promoTasks, content, contacts, outreach, metrics, tracks, scopeIds, since]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Campagnes actives" value={stats.active} hint={`${stats.campaigns} au total`} />
        <StatTile
          label="Tâches terminées à temps"
          value={stats.onTimeRate === null ? "—" : `${Math.round(stats.onTimeRate)} %`}
          hint={`${stats.completed} terminées`}
        />
        <StatTile label="Contenus publiés" value={stats.published} />
        <StatTile label="Contacts promo" value={stats.contacts} />
        <StatTile label="Envois promo" value={stats.outreach} />
        <StatTile label="Soutiens obtenus" value={stats.supports} tone="ok" />
        <StatTile label="Dépenses" value={formatMoney(stats.spend)} />
        <StatTile label="Revenus connus" value={formatMoney(stats.revenue)} />
      </div>

      <Card className="overflow-hidden">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Résultats par sortie
          </h2>
        </header>
        {stats.perRelease.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Aucun relevé enregistré. Les chiffres sont saisis manuellement dans l&apos;onglet
            Promotion d&apos;une track.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2 font-medium">Track</th>
                  <th className="px-3 py-2 font-medium">Streams</th>
                  <th className="px-3 py-2 font-medium">Auditeurs</th>
                  <th className="px-3 py-2 font-medium">Playlists</th>
                  <th className="px-3 py-2 font-medium">Supports DJ</th>
                  <th className="px-3 py-2 font-medium">Dépenses</th>
                </tr>
              </thead>
              <tbody>
                {stats.perRelease.map((row) => (
                  <tr key={row.metric.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/studio/${row.track!.id}?onglet=promotion`}
                        className="text-ink hover:text-accent-ink"
                      >
                        {row.track!.title}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-2 text-ink-soft">
                      {formatNumber(row.metric.spotify_streams)}
                    </td>
                    <td className="tabular px-3 py-2 text-ink-soft">
                      {formatNumber(row.metric.spotify_listeners)}
                    </td>
                    <td className="tabular px-3 py-2 text-ink-soft">
                      {formatNumber(row.metric.playlist_adds)}
                    </td>
                    <td className="tabular px-3 py-2 text-ink-soft">
                      {formatNumber(row.metric.dj_supports)}
                    </td>
                    <td className="tabular px-3 py-2 text-ink-soft">
                      {formatMoney((row.metric.ad_spend ?? 0) + (row.metric.other_spend ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
