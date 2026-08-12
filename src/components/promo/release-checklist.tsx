"use client";

import { useMemo, useState } from "react";
import { daysSince, formatDate } from "@/lib/format";
import { campaignProgress } from "@/lib/domain/progress";
import { releaseCountdown } from "@/lib/domain/board";
import { generatePromoPlan, offsetLabel, recomputeDueDate } from "@/lib/domain/promo-plan";
import { useData } from "@/lib/store/data";
import { Button, Checkbox, IconButton, Menu, MenuItem, ProgressBar, cn } from "@/components/ui";
import { IconMore, IconPlus } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { PromotionTask, Track } from "@/lib/types";

/**
 * Checklist de sortie d'une track, dans l'ordre du temps.
 *
 * Une seule liste, du plus lointain avant la sortie au suivi qui la suit : le
 * découpage en groupes J−28 / J−14 / J−7 reste lisible sur chaque ligne, sans
 * imposer un calendrier séparé.
 */
export function ReleaseChecklist({ track }: { track: Track }) {
  const { campaigns, promoTasks, insert, insertMany, update, remove, log } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const campaign = campaigns.find((c) => c.track_id === track.id);

  const tasks = useMemo(
    () =>
      promoTasks
        .filter((t) => t.track_id === track.id)
        .sort(
          (a, b) =>
            a.offset_days - b.offset_days ||
            (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
            a.position - b.position,
        ),
    [promoTasks, track.id],
  );

  const progress = campaignProgress(tasks);
  const countdown = releaseCountdown(track.release_date);
  const nextTask = tasks.find((t) => t.status === "a_faire" || t.status === "en_cours");

  /** Crée la campagne si besoin, puis y ajoute les étapes manquantes. */
  async function generate() {
    setBusy(true);
    try {
      const target =
        campaign ??
        (await insert("promotion_campaigns", {
          track_id: track.id,
          release_date: track.release_date,
          label_id: track.intended_label_id,
          distributor: track.distributor,
          status: "a_preparer",
        }));

      const existing = new Set(tasks.map((t) => t.title));
      const toCreate = generatePromoPlan(track.release_date).filter(
        (item) => !existing.has(item.title),
      );
      if (toCreate.length === 0) {
        toast.show("La checklist est déjà complète.");
        return;
      }
      await insertMany(
        "promotion_tasks",
        toCreate.map((item) => ({
          campaign_id: target.id,
          track_id: track.id,
          title: item.title,
          group_key: item.group_key,
          offset_days: item.offset_days,
          due_date: item.due_date,
          is_asset: item.is_asset,
          position: item.position,
          weight: item.weight,
        })),
      );
      log({
        entity_type: "promotion_campaign",
        entity_id: target.id,
        track_id: track.id,
        action: "campagne_creee",
        summary: "Checklist de sortie générée",
      });
      toast.success("Checklist générée");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: PromotionTask) {
    const done = task.status === "terminee";
    await update("promotion_tasks", task.id, {
      status: done ? "a_faire" : "terminee",
      completed_at: done ? null : new Date().toISOString(),
    });
  }

  async function addTask() {
    if (!campaign || !title.trim()) return;
    const offset = tasks[tasks.length - 1]?.offset_days ?? 0;
    await insert("promotion_tasks", {
      campaign_id: campaign.id,
      track_id: track.id,
      title: title.trim(),
      group_key: offsetLabel(offset),
      offset_days: offset,
      due_date: recomputeDueDate(track.release_date, offset),
      is_asset: false,
      position: tasks.reduce((max, t) => Math.max(max, t.position), 0) + 1,
    });
    setTitle("");
    setAdding(false);
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-2 text-sm text-muted">
        <span>Aucune étape de sortie préparée.</span>
        <Button size="sm" variant="primary" loading={busy} onClick={() => void generate()}>
          Générer la checklist
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        {countdown ? <p className="text-base font-medium text-ink">{countdown}</p> : null}
        {nextTask ? (
          <p className="text-sm text-accent-ink">Prochaine action : {nextTask.title}</p>
        ) : null}
      </div>

      <ProgressBar
        className="mb-3"
        value={progress.percent}
        label={`${progress.done} sur ${progress.total} étapes`}
        tone={progress.percent >= 100 ? "ok" : "info"}
      />

      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const done = task.status === "terminee";
          const late = task.due_date && !done ? (daysSince(task.due_date) ?? 0) > 0 : false;
          return (
            <li key={task.id} className="flex items-center gap-3 py-2">
              <Checkbox checked={done} onChange={() => void toggle(task)} />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-base",
                  done ? "text-muted line-through" : "text-ink-soft",
                )}
              >
                {task.title}
              </span>
              <span className="shrink-0 text-sm text-muted">
                {offsetLabel(task.offset_days)}
              </span>
              {task.due_date && !done ? (
                <span className={cn("shrink-0 text-sm", late ? "text-danger" : "text-muted")}>
                  {formatDate(task.due_date, "d MMM")}
                </span>
              ) : null}
              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={15} />
                  </IconButton>
                )}
              >
                <MenuItem destructive onClick={() => void remove("promotion_tasks", task.id)}>
                  Supprimer
                </MenuItem>
              </Menu>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTask();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nouvelle étape puis Entrée"
            className="h-9 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none"
          />
          <Button size="sm" variant="subtle" onClick={() => void addTask()}>
            Ajouter
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdding(true)}>
          <IconPlus size={15} />
          Ajouter une étape
        </Button>
      )}
    </div>
  );
}
