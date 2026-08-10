"use client";

import Link from "next/link";
import { PRIORITY_LABEL, accentHex } from "@/lib/constants";
import { daysSince, formatDate, relativeDayLabel } from "@/lib/format";
import type { TrackProgress } from "@/lib/domain/progress";
import { Badge, ProgressBar, cn } from "@/components/ui";
import { IconClock, IconWarning } from "@/components/ui/icons";
import type { Reminder, Stage, Track, Workspace } from "@/lib/types";

export interface TrackCardData {
  track: Track;
  workspace: Workspace | undefined;
  stage: Stage | undefined;
  progress: TrackProgress;
  nextReminder?: Reminder;
}

/**
 * Carte compacte d'une track : tout ce qu'il faut pour décider quoi faire,
 * sans ouvrir la fiche.
 */
export function TrackCard({
  data,
  onOpen,
  dragging,
  actions,
}: {
  data: TrackCardData;
  onOpen?: () => void;
  dragging?: boolean;
  actions?: React.ReactNode;
}) {
  const { track, workspace, stage, progress, nextReminder } = data;
  const idle = daysSince(track.last_activity_at);
  const accent = accentHex(workspace?.color);

  const meta = [
    track.genre,
    track.bpm ? `${Number(track.bpm)} BPM` : null,
    track.musical_key,
  ].filter(Boolean);

  const remaining = progress.production.remaining + progress.promotion.remaining;

  return (
    <article
      className={cn(
        "card card-hover group relative overflow-hidden p-3",
        dragging && "opacity-60 ring-1 ring-accent",
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-0.5"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/studio/${track.id}`}
            onClick={onOpen}
            className="block truncate text-[14px] font-medium text-ink hover:text-accent-ink"
          >
            {track.title}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {workspace?.name ?? "Sans espace"}
            {meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
          </p>
        </div>
        {actions}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {stage ? (
          <Badge dot={accentHex(stage.color)}>{stage.name}</Badge>
        ) : null}
        {track.priority !== "normale" ? (
          <Badge
            tone={
              track.priority === "urgente"
                ? "danger"
                : track.priority === "haute"
                  ? "warn"
                  : "neutre"
            }
          >
            {PRIORITY_LABEL[track.priority]}
          </Badge>
        ) : null}
        {track.is_blocked ? (
          <Badge tone="danger">
            <IconWarning size={11} />
            Bloquée
          </Badge>
        ) : null}
        {remaining > 0 ? (
          <Badge>
            {remaining} tâche{remaining > 1 ? "s" : ""}
          </Badge>
        ) : null}
      </div>

      {track.is_blocked && track.blocked_reason ? (
        <p className="mt-2 line-clamp-2-safe rounded-md border border-danger/20 bg-danger/5 px-2 py-1.5 text-[11px] leading-snug text-danger">
          {track.blocked_reason}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        <ProgressBar
          value={progress.production.percent}
          label="Production"
          tone={progress.production.percent >= 100 ? "ok" : "accent"}
          size="sm"
        />
        <ProgressBar
          value={progress.promotion.percent}
          label="Promotion"
          tone="info"
          size="sm"
        />
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[11px]">
        <span className={cn("text-faint", idle !== null && idle >= 14 && "text-warn")}>
          {idle === 0 ? "Actif aujourd'hui" : `Activité ${relativeDayLabel(track.last_activity_at)}`}
        </span>
        {track.release_date ? (
          <span className="text-ink-soft">Sortie {formatDate(track.release_date, "d MMM")}</span>
        ) : track.target_date ? (
          <span className="text-muted">Cible {formatDate(track.target_date, "d MMM")}</span>
        ) : null}
      </footer>

      {nextReminder ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-accent-ink">
          <IconClock size={12} />
          <span className="truncate">
            {nextReminder.title} · {relativeDayLabel(nextReminder.due_at)}
          </span>
        </p>
      ) : null}
    </article>
  );
}
