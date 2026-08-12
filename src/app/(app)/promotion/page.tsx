"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { campaignProgress } from "@/lib/domain/progress";
import { aliasLabel, nextActionOf, releaseCountdown } from "@/lib/domain/board";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Button, ProgressBar, SidePanel, cn } from "@/components/ui";
import { IconArrowRight } from "@/components/ui/icons";
import { TrackArtwork } from "@/components/tracks/track-artwork";
import { ReleaseChecklist } from "@/components/promo/release-checklist";
import type { Track } from "@/lib/types";

const ACTION_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-accent-ink",
  neutre: "text-ink-soft",
};

export default function PromotionPage() {
  const { labels } = useData();
  const {
    visibleTracks,
    workspaceById,
    promoTasksByTrack,
    submissionsByTrack,
    tasksByTrack,
    labelById,
    suggestions,
  } = useDerived();

  const [openTrack, setOpenTrack] = useState<Track | null>(null);

  /*
   * Une sortie existe dès qu'une date est posée ou qu'une préparation a
   * réellement commencé. Les autres tracks restent au Studio : elles n'ont rien
   * à faire ici tant qu'il n'y a rien à promouvoir.
   */
  const releases = useMemo(
    () =>
      visibleTracks
        .filter((track) => track.release_date || (promoTasksByTrack.get(track.id)?.length ?? 0) > 0)
        .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999")),
    [visibleTracks, promoTasksByTrack],
  );

  // Sur cette page, seuls les rappels de communication ont leur place.
  const todo = useMemo(() => suggestions.filter((s) => s.promoTaskId).slice(0, 3), [suggestions]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-5">
        <h1 className="text-[26px] font-semibold tracking-tight">Promotion</h1>
        <p className="mt-1 text-[13px] text-muted">
          Les tracks dont la sortie est datée ou déjà préparée.
        </p>
      </header>

      {todo.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">À faire maintenant</h2>
          <ul className="space-y-1.5">
            {todo.map((suggestion) => (
              <li key={suggestion.id}>
                <Link
                  href={suggestion.href}
                  className="card card-hover flex items-center gap-3 px-3.5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {suggestion.title}
                    </span>
                    <span className="block truncate text-[12px] text-faint">
                      {suggestion.reason}
                    </span>
                  </span>
                  <IconArrowRight size={16} className="shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {releases.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-3 text-[14px] text-muted">
          Aucune sortie prévue.
          <Link href="/studio">
            <Button variant="primary" size="sm">
              Choisir une track à sortir
            </Button>
          </Link>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {releases.map((track) => {
            const workspace = track.workspace_id
              ? workspaceById.get(track.workspace_id)
              : undefined;
            const promoTasks = promoTasksByTrack.get(track.id) ?? [];
            const progress = campaignProgress(promoTasks);
            const countdown = releaseCountdown(track.release_date);
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
                className="card card-hover p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <TrackArtwork track={track} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[16px] font-semibold leading-tight text-ink">
                      {track.title}
                    </h2>
                    <p className="mt-1 truncate text-[12px] text-faint">
                      {[aliasLabel(workspace?.name), label?.name].filter(Boolean).join(" · ") ||
                        "Sans label"}
                    </p>
                    {track.release_date ? (
                      <p className="mt-1.5 text-[13px] text-ink-soft">
                        {formatDate(track.release_date, "d MMMM yyyy")}
                        {countdown ? (
                          <span className="ml-1.5 text-accent-ink">· {countdown}</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[13px] text-muted">Date de sortie à définir</p>
                    )}
                  </div>
                </div>

                {promoTasks.length > 0 ? (
                  <ProgressBar
                    className="mt-3"
                    value={progress.percent}
                    label={`${progress.done} sur ${progress.total} étapes`}
                    tone={progress.percent >= 100 ? "ok" : "info"}
                  />
                ) : null}

                {action ? (
                  <p className={cn("mt-3 text-[12.5px] leading-snug", ACTION_TONE[action.tone])}>
                    {action.text}
                  </p>
                ) : null}
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
              <Button variant="outline" size="sm">
                Ouvrir la track
              </Button>
            </Link>
          ) : null
        }
      >
        {openTrack ? (
          <div className="px-5 py-4">
            <ReleaseChecklist track={openTrack} />
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
