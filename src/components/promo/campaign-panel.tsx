"use client";

import { useMemo, useState } from "react";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/constants";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { campaignProgress } from "@/lib/domain/progress";
import {
  generatePromoPlan,
  groupRank,
  recomputeDueDate,
} from "@/lib/domain/promo-plan";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  ProgressBar,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus, IconTarget } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { CampaignStatus, PromotionCampaign, PromotionTask, Track } from "@/lib/types";

/** Campagne promotionnelle d'une track : réglages, planning à rebours, assets. */
export function CampaignPanel({ track }: { track: Track }) {
  const { campaigns, promoTasks, labels, insert, insertMany, update, remove, log, removeMany } =
    useData();
  const toast = useToast();

  const campaign = campaigns.find((c) => c.track_id === track.id);
  const tasks = useMemo(
    () =>
      promoTasks
        .filter((t) => t.campaign_id === campaign?.id)
        .sort((a, b) => groupRank(a.group_key) - groupRank(b.group_key) || a.position - b.position),
    [promoTasks, campaign?.id],
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [releaseDate, setReleaseDate] = useState(track.release_date ?? "");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const schedule = tasks.filter((t) => !t.is_asset);
  const assets = tasks.filter((t) => t.is_asset);
  const progress = campaignProgress(tasks);

  async function createCampaign(withPlan: boolean) {
    const created = await insert("promotion_campaigns", {
      track_id: track.id,
      release_date: releaseDate || track.release_date || null,
      label_id: track.intended_label_id,
      distributor: track.distributor,
      status: "a_preparer",
    });

    if (releaseDate && releaseDate !== track.release_date) {
      await update("tracks", track.id, { release_date: releaseDate });
    }

    if (withPlan) {
      const plan = generatePromoPlan(releaseDate || track.release_date || null);
      await insertMany(
        "promotion_tasks",
        plan.map((item) => ({
          campaign_id: created.id,
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
    }

    log({
      entity_type: "promotion_campaign",
      entity_id: created.id,
      track_id: track.id,
      action: "campagne_creee",
      summary: `Campagne créée${withPlan ? " avec le planning complet" : ""}`,
    });
    toast.success("Campagne créée");
    setCreating(false);
  }

  async function generatePlan(options: { schedule: boolean; assets: boolean }) {
    if (!campaign) return;
    const plan = generatePromoPlan(campaign.release_date, {
      includeSchedule: options.schedule,
      includeAssets: options.assets,
    });
    const existing = new Set(tasks.map((t) => `${t.group_key}::${t.title}`));
    const toCreate = plan.filter((item) => !existing.has(`${item.group_key}::${item.title}`));
    if (toCreate.length === 0) {
      toast.show("Le planning est déjà complet.");
      return;
    }
    await insertMany(
      "promotion_tasks",
      toCreate.map((item) => ({
        campaign_id: campaign.id,
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
    toast.success(`${toCreate.length} tâches ajoutées`);
  }

  /** La date de sortie pilote tout le planning : on recalcule les échéances. */
  async function applyReleaseDate(nextDate: string | null) {
    if (!campaign) return;
    await update("promotion_campaigns", campaign.id, { release_date: nextDate });
    await update("tracks", track.id, { release_date: nextDate });
    for (const task of tasks) {
      const due = recomputeDueDate(nextDate, task.offset_days);
      if (due !== task.due_date) {
        await update("promotion_tasks", task.id, { due_date: due });
      }
    }
    log({
      entity_type: "promotion_campaign",
      entity_id: campaign.id,
      track_id: track.id,
      action: "date_sortie_modifiee",
      summary: nextDate
        ? `Date de sortie fixée au ${formatDate(nextDate)}, planning recalculé`
        : "Date de sortie retirée",
    });
  }

  async function addTask(groupKey: string) {
    if (!campaign || !newTitle.trim()) return;
    const isAsset = groupKey === "Assets";
    const sibling = tasks.filter((t) => t.group_key === groupKey);
    const offset = sibling[0]?.offset_days ?? 0;
    await insert("promotion_tasks", {
      campaign_id: campaign.id,
      track_id: track.id,
      title: newTitle.trim(),
      group_key: groupKey,
      offset_days: offset,
      due_date: recomputeDueDate(campaign.release_date, offset),
      is_asset: isAsset,
      position: sibling.reduce((max, t) => Math.max(max, t.position), 0) + 1,
    });
    setNewTitle("");
    setAddingTo(null);
  }

  if (!campaign) {
    return (
      <>
        <EmptyState
          icon={<IconTarget size={26} />}
          title="Aucune campagne de promotion"
          description={
            track.release_date
              ? `Une date de sortie est prévue le ${formatDate(track.release_date)}. Créez la campagne pour générer le planning à rebours.`
              : "Créez une campagne pour préparer la sortie : planning à rebours, assets, contenus et résultats."
          }
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Créer la campagne
            </Button>
          }
        />

        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          title="Nouvelle campagne"
          description="Le planning est calculé à rebours depuis la date de sortie."
          footer={
            <>
              <Button variant="ghost" onClick={() => void createCampaign(false)}>
                Sans planning
              </Button>
              <Button variant="primary" onClick={() => void createCampaign(true)}>
                Créer avec le planning
              </Button>
            </>
          }
        >
          <Field label="Date de sortie" hint="Modifiable à tout moment, le planning suivra.">
            <Input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </Field>
        </Modal>
      </>
    );
  }

  const untilRelease = campaign.release_date ? daysUntil(campaign.release_date) : null;
  const groups = [...new Set(tasks.map((t) => t.group_key))].sort(
    (a, b) => groupRank(a) - groupRank(b),
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">Campagne</h2>
              <Badge tone={campaign.status === "terminee" ? "ok" : "accent"}>
                {CAMPAIGN_STATUS_LABEL[campaign.status]}
              </Badge>
              {untilRelease !== null ? (
                <Badge tone={untilRelease < 0 ? "neutre" : untilRelease <= 7 ? "warn" : "info"}>
                  {untilRelease === 0
                    ? "Sortie aujourd'hui"
                    : untilRelease > 0
                      ? `J−${untilRelease}`
                      : `J+${Math.abs(untilRelease)}`}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {campaign.release_date
                ? `Sortie prévue le ${formatDate(campaign.release_date)}`
                : "Aucune date de sortie définie"}
              {campaign.budget ? ` · budget ${formatMoney(campaign.budget)}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onChange={(e) =>
                void update("promotion_campaigns", campaign.id, {
                  status: e.target.value as CampaignStatus,
                })
              }
              className="w-auto"
              aria-label="Statut de la campagne"
            >
              {(Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[]).map((status) => (
                <option key={status} value={status}>
                  {CAMPAIGN_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>

            <Menu
              trigger={(props) => (
                <IconButton label="Actions" {...props}>
                  <IconMore size={18} />
                </IconButton>
              )}
            >
              <MenuItem onClick={() => setEditing(true)}>Modifier la campagne</MenuItem>
              <MenuItem onClick={() => void generatePlan({ schedule: true, assets: false })}>
                Générer le planning
              </MenuItem>
              <MenuItem onClick={() => void generatePlan({ schedule: false, assets: true })}>
                Générer la checklist d&apos;assets
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                destructive
                onClick={() => void remove("promotion_campaigns", campaign.id)}
              >
                Supprimer la campagne
              </MenuItem>
            </Menu>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">Label</p>
            <p className="text-[13px] text-ink-soft">
              {labels.find((l) => l.id === campaign.label_id)?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">Distributeur</p>
            <p className="text-[13px] text-ink-soft">{campaign.distributor ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">Objectif principal</p>
            <p className="text-[13px] text-ink-soft">{campaign.main_goal ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">Audience cible</p>
            <p className="text-[13px] text-ink-soft">{campaign.target_audience ?? "—"}</p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <ProgressBar
            className="mt-4"
            value={progress.percent}
            label={`Avancement · ${progress.done}/${progress.total} tâches`}
            tone="info"
          />
        ) : null}

        {campaign.notes ? (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
            {campaign.notes}
          </p>
        ) : null}
      </Card>

      {tasks.length === 0 ? (
        <EmptyState
          title="Planning vide"
          description="Générez le planning à rebours et la checklist d'assets, puis adaptez-les."
          action={
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => void generatePlan({ schedule: true, assets: true })}
              >
                Générer le planning complet
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupTasks = tasks.filter((t) => t.group_key === group);
            const done = groupTasks.filter((t) => t.status === "terminee").length;
            return (
              <Card key={group} className="overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-ink">{group}</h3>
                    <span className="tabular text-[11px] text-faint">
                      {done}/{groupTasks.length}
                    </span>
                    {groupTasks[0]?.due_date && group !== "Assets" ? (
                      <span className="text-[11px] text-muted">
                        {formatDate(groupTasks[0].due_date)}
                      </span>
                    ) : null}
                  </div>
                  <IconButton
                    label="Ajouter une tâche"
                    onClick={() => setAddingTo(addingTo === group ? null : group)}
                  >
                    <IconPlus size={16} />
                  </IconButton>
                </header>

                <ul className="divide-y divide-line">
                  {groupTasks.map((task) => (
                    <PromoTaskRow key={task.id} task={task} />
                  ))}
                </ul>

                {addingTo === group ? (
                  <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addTask(group);
                        }
                        if (e.key === "Escape") setAddingTo(null);
                      }}
                      placeholder="Nouvelle tâche puis Entrée"
                      className="h-8 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] focus:border-accent focus:outline-none"
                    />
                    <Button size="sm" variant="primary" onClick={() => void addTask(group)}>
                      Ajouter
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <CampaignEditor
        campaign={campaign}
        open={editing}
        onClose={() => setEditing(false)}
        onReleaseDateChange={applyReleaseDate}
      />
    </div>
  );
}

function PromoTaskRow({ task }: { task: PromotionTask }) {
  const { update, remove } = useData();
  const done = task.status === "terminee";
  const overdue =
    !done && task.due_date ? (daysUntil(task.due_date) ?? 0) < 0 : false;

  return (
    <li className="group flex items-center gap-3 px-4 py-2">
      <Checkbox
        checked={done}
        onChange={(checked) =>
          void update("promotion_tasks", task.id, {
            status: checked ? "terminee" : "a_faire",
            completed_at: checked ? new Date().toISOString() : null,
          })
        }
      />
      <span
        className={cn(
          "min-w-0 flex-1 text-[13px]",
          done ? "text-faint line-through" : "text-ink-soft",
        )}
      >
        {task.title}
      </span>
      {task.due_date && !task.is_asset ? (
        <span className={cn("shrink-0 text-[11px]", overdue ? "text-danger" : "text-faint")}>
          {formatDate(task.due_date, "d MMM")}
        </span>
      ) : null}
      <IconButton
        label="Supprimer"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100"
        onClick={() => void remove("promotion_tasks", task.id)}
      >
        <IconMore size={15} />
      </IconButton>
    </li>
  );
}

function CampaignEditor({
  campaign,
  open,
  onClose,
  onReleaseDateChange,
}: {
  campaign: PromotionCampaign;
  open: boolean;
  onClose: () => void;
  onReleaseDateChange: (date: string | null) => Promise<void>;
}) {
  const { labels, update } = useData();
  const [releaseDate, setReleaseDate] = useState(campaign.release_date ?? "");
  const [labelId, setLabelId] = useState(campaign.label_id ?? "");
  const [distributor, setDistributor] = useState(campaign.distributor ?? "");
  const [goal, setGoal] = useState(campaign.main_goal ?? "");
  const [budget, setBudget] = useState(campaign.budget !== null ? String(campaign.budget) : "");
  const [audience, setAudience] = useState(campaign.target_audience ?? "");
  const [notes, setNotes] = useState(campaign.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await update("promotion_campaigns", campaign.id, {
        label_id: labelId || null,
        distributor: distributor.trim() || null,
        main_goal: goal.trim() || null,
        budget: budget.trim() ? Number(budget.replace(",", ".")) : null,
        target_audience: audience.trim() || null,
        notes: notes.trim() || null,
      });
      if ((releaseDate || null) !== campaign.release_date) {
        await onReleaseDateChange(releaseDate || null);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifier la campagne"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Date de sortie"
          hint="Modifier cette date recalcule automatiquement toutes les échéances du planning."
        >
          <Input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label">
            <Select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
              <option value="">—</option>
              {labels
                .filter((l) => !l.archived)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Distributeur">
            <Input value={distributor} onChange={(e) => setDistributor(e.target.value)} />
          </Field>
        </div>
        <Field label="Objectif principal">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Playlists éditoriales, soutien DJ, premier palier de streams…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget (€)">
            <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          <Field label="Audience cible">
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
