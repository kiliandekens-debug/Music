"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CONTACT_CATEGORY_LABEL,
  CONTENT_STATUS_LABEL,
  PLATFORM_LABEL,
  SUPPORT_TYPE_LABEL,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  Modal,
  Select,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus } from "@/components/ui/icons";
import { ContentForm, MetricForm, OutreachForm } from "./forms";
import type { ContentItem, ContentStatus, ReleaseMetric } from "@/lib/types";

const STATUS_TONE: Record<ContentStatus, "neutre" | "info" | "ok" | "warn"> = {
  idee: "neutre",
  a_preparer: "warn",
  pret: "info",
  planifie: "info",
  publie: "ok",
  annule: "neutre",
};

// --- Calendrier de contenu ---------------------------------------------------

export function ContentList({ trackId }: { trackId?: string }) {
  const { content, tracks, update, remove } = useData();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);

  const items = useMemo(
    () =>
      content
        .filter((item) => (trackId ? item.track_id === trackId : true))
        .sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999")),
    [content, trackId],
  );

  return (
    <>
      <Card className="overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Calendrier de contenu
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <IconPlus size={15} />
            Planifier
          </Button>
        </header>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Aucun contenu planifié.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] text-ink">{item.title}</span>
                    <Badge>{PLATFORM_LABEL[item.platform]}</Badge>
                    <Badge tone={STATUS_TONE[item.status]}>
                      {CONTENT_STATUS_LABEL[item.status]}
                    </Badge>
                    {item.content_type ? <Badge>{item.content_type}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {item.scheduled_at ? formatDateTime(item.scheduled_at) : "Sans date"}
                    {!trackId && item.track_id
                      ? ` · ${tracks.find((t) => t.id === item.track_id)?.title ?? ""}`
                      : ""}
                  </p>
                  {item.published_url ? (
                    <a
                      href={item.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:underline"
                    >
                      Voir la publication
                    </a>
                  ) : null}
                </div>

                <Menu
                  trigger={(props) => (
                    <IconButton label="Actions" {...props}>
                      <IconMore size={16} />
                    </IconButton>
                  )}
                >
                  <MenuItem onClick={() => setEditing(item)}>Modifier</MenuItem>
                  <MenuLabel>Statut</MenuLabel>
                  {(Object.keys(CONTENT_STATUS_LABEL) as ContentStatus[]).map((status) => (
                    <MenuItem
                      key={status}
                      disabled={item.status === status}
                      onClick={() => void update("content_calendar", item.id, { status })}
                    >
                      {CONTENT_STATUS_LABEL[status]}
                    </MenuItem>
                  ))}
                  <MenuItem destructive onClick={() => void remove("content_calendar", item.id)}>
                    Supprimer
                  </MenuItem>
                </Menu>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Planifier un contenu">
        <ContentForm
          defaultTrackId={trackId}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le contenu">
        {editing ? (
          <ContentForm
            item={editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}

// --- Envois promotionnels ----------------------------------------------------

export function OutreachList({ trackId }: { trackId?: string }) {
  const { outreach, contacts, tracks, remove } = useData();
  const [adding, setAdding] = useState(false);

  const items = useMemo(
    () =>
      outreach
        .filter((item) => (trackId ? item.track_id === trackId : true))
        .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? "")),
    [outreach, trackId],
  );

  return (
    <>
      <Card className="overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Envois promotionnels
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <IconPlus size={15} />
            Enregistrer
          </Button>
        </header>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Aucun envoi promotionnel enregistré.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const contact = contacts.find((c) => c.id === item.contact_id);
              return (
                <li key={item.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] text-ink">
                        {contact?.name ?? "Contact supprimé"}
                      </span>
                      {contact ? <Badge>{CONTACT_CATEGORY_LABEL[contact.category]}</Badge> : null}
                      {item.support_type !== "aucun" ? (
                        <Badge tone="ok">{SUPPORT_TYPE_LABEL[item.support_type]}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {item.sent_at ? `Envoyé le ${formatDate(item.sent_at)}` : "Non envoyé"}
                      {item.responded_at ? ` · réponse le ${formatDate(item.responded_at)}` : ""}
                      {!trackId
                        ? ` · ${tracks.find((t) => t.id === item.track_id)?.title ?? ""}`
                        : ""}
                    </p>
                    {item.comment ? (
                      <p className="mt-1 text-[12px] text-muted">{item.comment}</p>
                    ) : null}
                  </div>
                  <IconButton
                    label="Supprimer"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => void remove("promotion_outreach", item.id)}
                  >
                    <IconMore size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Envoi promotionnel">
        <OutreachForm
          defaultTrackId={trackId}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </>
  );
}

// --- Résultats ---------------------------------------------------------------

const CHART_SERIES: { key: keyof ReleaseMetric; label: string }[] = [
  { key: "spotify_streams", label: "Streams Spotify" },
  { key: "spotify_listeners", label: "Auditeurs" },
  { key: "saves", label: "Sauvegardes" },
  { key: "playlist_adds", label: "Ajouts playlist" },
  { key: "youtube_views", label: "Vues YouTube" },
  { key: "soundcloud_plays", label: "Écoutes SoundCloud" },
];

export function MetricsPanel({ trackId }: { trackId?: string }) {
  const { metrics, tracks, remove } = useData();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ReleaseMetric | null>(null);
  const [series, setSeries] = useState<string>("spotify_streams");

  const rows = useMemo(
    () =>
      metrics
        .filter((m) => (trackId ? m.track_id === trackId : true))
        .sort((a, b) => a.measured_on.localeCompare(b.measured_on)),
    [metrics, trackId],
  );

  const chartData = useMemo(
    () =>
      rows
        .filter((row) => row[series as keyof ReleaseMetric] !== null)
        .map((row) => ({
          date: formatDate(row.measured_on, "d MMM"),
          valeur: Number(row[series as keyof ReleaseMetric] ?? 0),
        })),
    [rows, series],
  );

  const latest = rows[rows.length - 1];

  return (
    <>
      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Résultats de sortie
          </h3>
          <div className="flex items-center gap-2">
            <Select
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              className="w-auto"
              aria-label="Indicateur"
            >
              {CHART_SERIES.map((item) => (
                <option key={item.key as string} value={item.key as string}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <IconPlus size={15} />
              Relevé
            </Button>
          </div>
        </header>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Aucun relevé. Les chiffres sont saisis manuellement : rien n&apos;est estimé.
          </p>
        ) : (
          <>
            {chartData.length > 1 ? (
              <div className="h-52 px-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis
                      dataKey="date"
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
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-line)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--color-muted)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valeur"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="px-4 pt-4 text-center text-[12px] text-faint">
                Ajoutez au moins deux relevés pour visualiser l&apos;évolution.
              </p>
            )}

            {latest ? (
              <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4">
                {CHART_SERIES.slice(0, 4).map((item) => (
                  <div key={item.key as string}>
                    <p className="text-[11px] uppercase tracking-wide text-faint">{item.label}</p>
                    <p className="tabular text-lg font-semibold text-ink">
                      {formatNumber(latest[item.key] as number | null)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-2 font-medium">Date</th>
                    {!trackId ? <th className="px-3 py-2 font-medium">Track</th> : null}
                    <th className="px-3 py-2 font-medium">Streams</th>
                    <th className="px-3 py-2 font-medium">Playlists</th>
                    <th className="px-3 py-2 font-medium">Dépenses</th>
                    <th className="px-3 py-2 font-medium">Revenus</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-ink-soft">
                        {formatDate(row.measured_on)}
                      </td>
                      {!trackId ? (
                        <td className="px-3 py-2 text-muted">
                          {tracks.find((t) => t.id === row.track_id)?.title ?? "—"}
                        </td>
                      ) : null}
                      <td className="tabular px-3 py-2 text-ink-soft">
                        {formatNumber(row.spotify_streams)}
                      </td>
                      <td className="tabular px-3 py-2 text-ink-soft">
                        {formatNumber(row.playlist_adds)}
                      </td>
                      <td className="tabular px-3 py-2 text-ink-soft">
                        {formatMoney((row.ad_spend ?? 0) + (row.other_spend ?? 0))}
                      </td>
                      <td className="tabular px-3 py-2 text-ink-soft">
                        {formatMoney(row.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Menu
                          align="right"
                          trigger={(props) => (
                            <IconButton label="Actions" {...props}>
                              <IconMore size={15} />
                            </IconButton>
                          )}
                        >
                          <MenuItem onClick={() => setEditing(row)}>Modifier</MenuItem>
                          <MenuItem
                            destructive
                            onClick={() => void remove("release_metrics", row.id)}
                          >
                            Supprimer
                          </MenuItem>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Nouveau relevé" size="lg">
        <MetricForm
          defaultTrackId={trackId}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le relevé" size="lg">
        {editing ? (
          <MetricForm
            metric={editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
