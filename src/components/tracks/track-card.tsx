"use client";

import Link from "next/link";
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
import { Badge, ProgressBar, cn } from "@/components/ui";
import { IconArrowRight, IconWarning } from "@/components/ui/icons";
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

/**
 * Carte d'une track : le strict nécessaire pour décider quoi faire.
 * Rien qui vaille zéro n'est affiché — un compteur vide n'aide personne.
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
  const subStep = subStepOf(stage);
  const labelStatus = labelStatusOf(data.submissions);
  const nextAction = nextActionOf({
    tasks: data.tasks,
    promoTasks: data.promoTasks,
    submissions: data.submissions,
    labelName: data.labelName,
    releaseDate: track.release_date,
  });

  // La promotion n'apparaît que si une campagne a réellement été lancée.
  const promoStarted = data.promoTasks.length > 0;

  return (
    <article
      className={cn(
        "card card-hover group relative overflow-hidden",
        dragging && "opacity-60 ring-1 ring-accent",
      )}
    >
      <Link href={`/studio/${track.id}`} className="block p-3.5">
        <h3 className="truncate pr-6 text-[15px] font-semibold leading-tight text-ink">
          {track.title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-faint">
          {alias ? <span className="text-muted">{alias}</span> : null}
          {alias && subStep ? <span aria-hidden>·</span> : null}
          {subStep ? <span>{SUB_STEP_LABEL[subStep]}</span> : null}
        </p>

        {track.is_blocked ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-danger">
            <IconWarning size={13} className="shrink-0" />
            <span className="truncate">{track.blocked_reason || "Bloquée"}</span>
          </p>
        ) : null}

        {progress.production.total > 0 ? (
          <ProgressBar
            className="mt-3"
            value={progress.production.percent}
            tone={progress.production.percent >= 100 ? "ok" : "accent"}
            showValue={false}
            size="sm"
          />
        ) : null}

        {promoStarted ? (
          <ProgressBar
            className="mt-2"
            value={progress.promotion.percent}
            label="Promo"
            showValue={false}
            tone="info"
            size="sm"
          />
        ) : null}

        {nextAction ? (
          <p
            className={cn(
              "mt-3 flex items-center gap-1.5 text-[12.5px] leading-snug",
              ACTION_TONE[nextAction.tone],
            )}
          >
            <IconArrowRight size={13} className="mt-px shrink-0" />
            <span className="line-clamp-2-safe">{nextAction.text}</span>
          </p>
        ) : null}

        {labelStatus || track.release_date ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
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
              <span className="text-[12px] text-muted">
                Sortie {formatDate(track.release_date, "d MMM")}
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>

      {actions ? <div className="absolute right-2 top-2">{actions}</div> : null}
    </article>
  );
}
