"use client";

import Link from "next/link";
import { accentHex } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import {
  SUB_STEP_LABEL,
  aliasLabel,
  labelStatusOf,
  nextActionOf,
  subStepOf,
  type NextAction,
} from "@/lib/domain/board";
import type { TrackProgress } from "@/lib/domain/progress";
import { Badge, Meter, cn } from "@/components/ui";
import { IconWarning } from "@/components/ui/icons";
import { TrackArtwork } from "./track-artwork";
import type {
  LabelSubmission,
  PromotionTask,
  Stage,
  Track,
  TrackTask,
  Workspace,
} from "@/lib/types";

export interface TrackCardData {
  track: Track;
  workspace: Workspace | undefined;
  stage: Stage | undefined;
  progress: TrackProgress;
  tasks: TrackTask[];
  promoTasks: PromotionTask[];
  submissions: LabelSubmission[];
  labelName: (labelId: string) => string;
}

const ACTION_TONE: Record<NextAction["tone"], string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-accent-ink",
  neutre: "text-ink-soft",
};

const ACTION_DOT: Record<NextAction["tone"], string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-accent",
  neutre: "bg-line-strong",
};

/**
 * Carte d'une track.
 *
 * Elle doit se lire d'un coup d'œil, de haut en bas : la pochette et le titre
 * disent quelle track, la couleur de l'alias dit sous quel nom, la barre dit où
 * on en est, la ligne colorée dit quoi faire ensuite. Rien qui vaille zéro n'est
 * affiché : un compteur vide n'aide personne.
 */
export function TrackCard({
  data,
  dragging,
  actions,
}: {
  data: TrackCardData;
  dragging?: boolean;
  actions?: React.ReactNode;
}) {
  const { track, workspace, stage, progress } = data;

  const alias = aliasLabel(workspace?.name);
  const color = accentHex(workspace?.color);
  const subStep = subStepOf(stage);
  const labelStatus = labelStatusOf(data.submissions);
  const nextAction = nextActionOf({
    tasks: data.tasks,
    promoTasks: data.promoTasks,
    submissions: data.submissions,
    labelName: data.labelName,
    releaseDate: track.release_date,
  });

  // La promotion n'apparaît que si une sortie a réellement été préparée.
  const promoStarted = data.promoTasks.length > 0;
  const percent = progress.production.percent;

  return (
    <article
      className={cn(
        "card card-hover group relative overflow-hidden",
        dragging && "opacity-70 ring-1 ring-accent",
      )}
    >
      {/* Liseré d'alias : on sait de quel projet il s'agit sans lire. */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />

      <Link href={`/studio/${track.id}`} className="block py-4 pl-4 pr-3.5">
        <div className="flex items-start gap-3">
          <TrackArtwork
            track={track}
            color={color}
            className="h-10 w-10 rounded-[10px]"
            iconSize={15}
          />
          <div className="min-w-0 flex-1">
            {/* Un titre de track ne se coupe pas : il passe à la ligne. */}
            <h3 className="line-clamp-2-safe pr-8 text-title font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
              {track.title}
            </h3>
            <p className="mt-1.5 truncate text-sm text-muted">
              {[alias, subStep ? SUB_STEP_LABEL[subStep] : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {track.is_blocked ? (
          <p className="mt-3 flex items-start gap-1.5 text-sm leading-snug text-danger">
            <IconWarning size={14} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2-safe">{track.blocked_reason || "Bloquée"}</span>
          </p>
        ) : null}

        {progress.production.total > 0 ? (
          <div className="mt-4 flex items-center gap-2.5">
            <Meter
              className="flex-1"
              value={percent}
              color={percent >= 100 ? "var(--color-ok)" : color}
              label="Production"
            />
            <span className="tabular shrink-0 text-sm font-medium text-ink-soft">{percent} %</span>
          </div>
        ) : null}

        {promoStarted ? (
          <div className="mt-2 flex items-center gap-2.5">
            <span className="shrink-0 text-label uppercase tracking-wide text-muted">Promo</span>
            <Meter
              thin
              className="flex-1"
              value={progress.promotion.percent}
              color="var(--color-info)"
              label="Promotion"
            />
          </div>
        ) : null}

        {nextAction ? (
          <p
            className={cn(
              "mt-4 flex items-start gap-2 text-sm leading-snug",
              ACTION_TONE[nextAction.tone],
            )}
          >
            <span
              className={cn("mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full", ACTION_DOT[nextAction.tone])}
              aria-hidden
            />
            <span className="line-clamp-2-safe">{nextAction.text}</span>
          </p>
        ) : null}

        {labelStatus || track.release_date ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
            {labelStatus ? (
              <Badge
                tone={
                  labelStatus.tone === "ok"
                    ? "ok"
                    : labelStatus.tone === "warn"
                      ? "warn"
                      : labelStatus.tone === "info"
                        ? "info"
                        : "neutre"
                }
              >
                {labelStatus.text}
              </Badge>
            ) : null}
            {track.release_date ? (
              <span className="text-sm text-ink-soft">
                Sortie {formatDate(track.release_date, "d MMM")}
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>

      {actions ? <div className="absolute right-2.5 top-3.5">{actions}</div> : null}
    </article>
  );
}
