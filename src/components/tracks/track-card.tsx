"use client";

import { useState } from "react";
import Link from "next/link";
import { accentHex } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import {
  SUB_STEP_LABEL,
  labelStatusOf,
  nextActionOf,
  subStepOf,
  type NextAction,
} from "@/lib/domain/board";
import type { TrackProgress } from "@/lib/domain/progress";
import { Badge, Checkbox, Meter, cn } from "@/components/ui";
import { IconChevronLeft, IconChevronRight, IconTag, IconWarning } from "@/components/ui/icons";
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
  /** Label visé ou signé, affiché sous le titre. */
  labelTitle: string | null;
}

const ACTION_TONE: Record<NextAction["tone"], string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-accent-ink",
  neutre: "text-ink-soft",
};

/**
 * Carte d'une track : compacte, tout se lit sans ouvrir la fiche.
 *
 * Titre, label, BPM et tonalité, avancement chiffré, puis une barre d'actions :
 * le nombre de tâches faites, qui se déplie sur la carte, et deux flèches pour
 * faire avancer la track d'une colonne sans quitter le tableau.
 */
export function TrackCard({
  data,
  dragging,
  actions,
  onMove,
  canMoveBack,
  canMoveForward,
  onToggleTask,
}: {
  data: TrackCardData;
  dragging?: boolean;
  actions?: React.ReactNode;
  onMove?: (direction: -1 | 1) => void;
  canMoveBack?: boolean;
  canMoveForward?: boolean;
  onToggleTask?: (task: TrackTask) => void;
}) {
  const { track, workspace, progress, labelTitle } = data;
  const [openList, setOpenList] = useState(false);

  const color = accentHex(workspace?.color);
  const labelStatus = labelStatusOf(data.submissions);
  const nextAction = nextActionOf({
    tasks: data.tasks,
    promoTasks: data.promoTasks,
    submissions: data.submissions,
    labelName: data.labelName,
    releaseDate: track.release_date,
  });

  const checklist = data.tasks
    .filter((t) => t.category === "production" && t.status !== "ignoree")
    .sort((a, b) => a.position - b.position);
  const done = checklist.filter((t) => t.status === "terminee").length;
  const percent = progress.production.percent;
  const promoStarted = data.promoTasks.length > 0;

  // La colonne est large : la sous-étape précise où on en est à l'intérieur.
  const subStep = subStepOf(data.stage);
  // Un nom d'étape est un mot, un BPM est une mesure : ils ne s'écrivent pas
  // dans la même fonte.
  const readout = [track.bpm ? `${Number(track.bpm)} BPM` : null, track.musical_key]
    .filter(Boolean)
    .join(" · ");

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

      <div className="py-3 pl-4 pr-3">
        <Link href={`/studio/${track.id}`} className="block">
          <h3 className="line-clamp-2-safe pr-7 text-title leading-[1.15] text-ink">
            {track.title}
          </h3>

          {labelTitle ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
              <span className="shrink-0" style={{ color }}>
                <IconTag size={13} />
              </span>
              <span className="truncate">{labelTitle}</span>
            </p>
          ) : null}

          {subStep || readout ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted">
              {subStep ? <span>{SUB_STEP_LABEL[subStep]}</span> : null}
              {subStep && readout ? <span aria-hidden>·</span> : null}
              {readout ? <span className="readout">{readout}</span> : null}
            </p>
          ) : null}

          {track.is_blocked ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-danger">
              <IconWarning size={13} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2-safe">{track.blocked_reason || "Bloquée"}</span>
            </p>
          ) : null}

          {progress.production.total > 0 ? (
            <div className="mt-3 flex items-center gap-2.5">
              <Meter
                className="flex-1"
                value={percent}
                color={percent >= 100 ? "var(--color-ok)" : color}
                label="Production"
              />
              <span className="readout shrink-0 text-sm font-medium text-ink-soft">
                {percent} %
              </span>
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

          {nextAction && checklist.length === 0 ? (
            <p className={cn("mt-2.5 text-sm leading-snug", ACTION_TONE[nextAction.tone])}>
              {nextAction.text}
            </p>
          ) : null}

          {labelStatus || track.release_date ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
                <span className="text-sm text-muted">
                  Sortie {formatDate(track.release_date, "d MMM")}
                </span>
              ) : null}
            </div>
          ) : null}
        </Link>

        {/* Barre d'actions : l'avancement se déplie, les flèches font avancer. */}
        <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2">
          {checklist.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpenList((v) => !v)}
              aria-expanded={openList}
              className="-ml-1 flex min-w-0 items-center gap-1 rounded-md px-1 py-1 text-sm text-muted transition-colors hover:text-ink"
            >
              <IconChevronRight
                size={14}
                className={cn("shrink-0 transition-transform duration-150", openList && "rotate-90")}
              />
              <span className="readout truncate">
                {done}/{checklist.length} fait{done > 1 ? "s" : ""}
              </span>
            </button>
          ) : (
            <span className="text-sm text-muted">Aucune tâche</span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <MoveButton
              label="Reculer d'une colonne"
              disabled={!canMoveBack}
              onClick={() => onMove?.(-1)}
            >
              <IconChevronLeft size={15} />
            </MoveButton>
            <MoveButton
              label="Avancer d'une colonne"
              disabled={!canMoveForward}
              onClick={() => onMove?.(1)}
            >
              <IconChevronRight size={15} />
            </MoveButton>
          </div>
        </div>

        {openList && checklist.length > 0 ? (
          <ul className="mt-1 space-y-0.5 border-t border-line/60 pt-2">
            {checklist.map((task) => (
              <li key={task.id} className="flex items-center gap-2 py-0.5">
                <Checkbox
                  checked={task.status === "terminee"}
                  onChange={() => onToggleTask?.(task)}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    task.status === "terminee" ? "text-muted line-through" : "text-ink-soft",
                  )}
                >
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {actions ? <div className="absolute right-2 top-2">{actions}</div> : null}
    </article>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-soft transition-colors duration-100",
        disabled
          ? "cursor-not-allowed opacity-30"
          : "hover:border-line-strong hover:bg-surface-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
