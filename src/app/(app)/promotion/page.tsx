"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { accentHex } from "@/lib/constants";
import { formatDate, daysUntil, plural } from "@/lib/format";
import { campaignProgress } from "@/lib/domain/progress";
import { aliasLabel, nextActionOf } from "@/lib/domain/board";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Button, Meter, SidePanel, cn } from "@/components/ui";
import { PageHeader } from "@/components/layout/page-header";
import { TrackArtwork } from "@/components/tracks/track-artwork";
import { ReleaseChecklist } from "@/components/promo/release-checklist";
import type { Track } from "@/lib/types";

const ACTION_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-accent-ink",
  neutre: "text-ink-soft",
};

/** Compte à rebours en deux morceaux : le nombre, puis son unité. */
function countdown(releaseDate: string | null): { value: string; unit: string; soon: boolean } | null {
  if (!releaseDate) return null;
  const days = daysUntil(releaseDate);
  if (days === null) return null;
  if (days === 0) return { value: "Aujourd'hui", unit: "", soon: true };
  if (days > 0) return { value: `J−${days}`, unit: days === 1 ? "demain" : `dans ${days} jours`, soon: days <= 14 };
  const past = Math.abs(days);
  return { value: `J+${past}`, unit: past === 1 ? "hier" : `il y a ${past} jours`, soon: false };
}

export default function PromotionPage() {
  const { labels } = useData();
  const {
    visibleTracks,
    workspaceById,
    promoTasksByTrack,
    submissionsByTrack,
    tasksByTrack,
    labelById,
  } = useDerived();

  const [openTrack, setOpenTrack] = useState<Track | null>(null);

  /*
   * Une sortie existe dès qu'une date est posée ou qu'une préparation a
   * réellement commencé. Les autres tracks restent au Studio.
   */
  const releases = useMemo(
    () =>
      visibleTracks
        .filter((track) => track.release_date || (promoTasksByTrack.get(track.id)?.length ?? 0) > 0)
        .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999")),
    [visibleTracks, promoTasksByTrack],
  );

  /** La sortie datée la plus proche, pour le surtitre. */
  const next = useMemo(() => {
    const upcoming = releases
      .map((t) => ({ t, days: t.release_date ? daysUntil(t.release_date) : null }))
      .filter((r): r is { t: Track; days: number } => r.days !== null && r.days >= 0)
      .sort((a, b) => a.days - b.days)[0];
    if (!upcoming) return null;
    return upcoming.days === 0 ? "aujourd'hui" : `dans ${plural(upcoming.days, "jour")}`;
  }, [releases]);

  return (
    <div className="mx-auto w-full max-w-[1560px] px-5 pb-16 pt-4 lg:px-10 lg:pt-9">
      <PageHeader
        title="Promotion"
        eyebrow={
          <>
            {plural(releases.length, "sortie")}
            {next ? ` · prochaine ${next}` : ""}
          </>
        }
      />

      {releases.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-4 text-base text-muted">
          Aucune sortie prévue.
          <Link href="/studio">
            <Button variant="primary">Choisir une track à sortir</Button>
          </Link>
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {releases.map((track) => {
            const workspace = track.workspace_id
              ? workspaceById.get(track.workspace_id)
              : undefined;
            const color = accentHex(workspace?.color);
            const promoTasks = promoTasksByTrack.get(track.id) ?? [];
            const progress = campaignProgress(promoTasks);
            const count = countdown(track.release_date);
            const label = track.intended_label_id
              ? labels.find((l) => l.id === track.intended_label_id)
              : undefined;
            const action = nextActionOf({
              tasks: tasksByTrack.get(track.id) ?? [],
              promoTasks,
              submissions: submissionsByTrack.get(track.id) ?? [],
              labelName: (id) => labelById.get(id)?.name ?? "ce label",
              releaseDate: track.release_date,
            });

            return (
              <button
                key={track.id}
                type="button"
                onClick={() => setOpenTrack(track)}
                className="card card-hover overflow-hidden text-left"
              >
                {/* La pochette porte la carte : c'est une sortie, pas une ligne de tableau. */}
                <div className="relative">
                  <TrackArtwork
                    track={track}
                    color={color}
                    className="aspect-[16/10] w-full rounded-none"
                    detailed
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, var(--color-surface) 4%, transparent 62%)",
                    }}
                    aria-hidden
                  />
                  {count ? (
                    <span
                      className={cn(
                        "readout absolute right-3 top-3 rounded-full px-3 py-1 text-sm font-semibold backdrop-blur",
                        count.soon
                          ? "bg-accent text-white"
                          : "bg-canvas/70 text-ink-soft",
                      )}
                    >
                      {count.value}
                    </span>
                  ) : null}
                </div>

                <div className="p-5">
                  <h2 className="truncate text-title">
                    {track.title}
                  </h2>
                  <p className="mt-1 truncate text-sm text-muted">
                    {[aliasLabel(workspace?.name), label?.name].filter(Boolean).join(" · ") ||
                      "Sans label"}
                  </p>

                  <p className="mt-3 text-sm text-ink-soft">
                    {track.release_date ? (
                      <>
                        <span className="readout">
                          {formatDate(track.release_date, "d MMMM yyyy")}
                        </span>
                        {count?.unit ? <span className="text-muted"> · {count.unit}</span> : null}
                      </>
                    ) : (
                      "Date de sortie à définir"
                    )}
                  </p>

                  {promoTasks.length > 0 ? (
                    <div className="mt-4 flex items-center gap-3">
                      <Meter
                        segments={18}
                        className="flex-1"
                        value={progress.percent}
                        color={progress.percent >= 100 ? "var(--color-ok)" : "var(--color-info)"}
                        label="Préparation de la sortie"
                      />
                      <span className="readout shrink-0 text-sm text-muted">
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                  ) : null}

                  {action ? (
                    <p
                      className={cn(
                        "mt-3 truncate text-sm",
                        ACTION_TONE[action.tone] ?? "text-ink-soft",
                      )}
                    >
                      {action.text}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SidePanel
        open={openTrack !== null}
        onClose={() => setOpenTrack(null)}
        title={openTrack?.title ?? ""}
        subtitle={
          openTrack?.release_date
            ? `Sortie le ${formatDate(openTrack.release_date, "d MMMM yyyy")}`
            : "Date de sortie à définir"
        }
        footer={
          openTrack ? (
            <Link href={`/studio/${openTrack.id}`}>
              <Button variant="outline">Ouvrir la track</Button>
            </Link>
          ) : null
        }
      >
        {openTrack ? (
          <div className="px-5 py-5">
            <ReleaseChecklist track={openTrack} />
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
