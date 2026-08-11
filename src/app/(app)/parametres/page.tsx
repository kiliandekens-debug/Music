"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCENTS,
  ACCENT_KEYS,
  APP_NAME,
  DEFAULT_STAGES,
  FOLLOWUP_PRESETS,
  PHASES,
  PHASE_LABEL,
  accentHex,
} from "@/lib/constants";
import { SEED_TEMPLATES } from "@/lib/domain/templates";
import { getSupabase } from "@/lib/supabase/client";
import { useData } from "@/lib/store/data";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Modal,
  SectionTitle,
  Select,
  Tabs,
  Textarea,
  cn,
} from "@/components/ui";
import { IconLogout, IconMore, IconPlus, IconTrash } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { ChecklistTemplate, Stage, TaskCategory, Workspace } from "@/lib/types";

export default function SettingsPage() {
  const [tab, setTab] = useState("preferences");

  return (
    <div className="px-4 py-5 lg:px-6">
      <Tabs
        active={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { id: "preferences", label: "Préférences" },
          { id: "espaces", label: "Espaces" },
          { id: "pipeline", label: "Pipeline" },
          { id: "modeles", label: "Modèles de checklists" },
          { id: "compte", label: "Compte" },
        ]}
      />

      {tab === "preferences" ? <PreferencesTab /> : null}
      {tab === "espaces" ? <WorkspacesTab /> : null}
      {tab === "pipeline" ? <StagesTab /> : null}
      {tab === "modeles" ? <TemplatesTab /> : null}
      {tab === "compte" ? <AccountTab /> : null}
    </div>
  );
}

// --- Préférences -------------------------------------------------------------

function PreferencesTab() {
  const { profile, updateProfile } = useData();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [followup, setFollowup] = useState(profile?.default_followup_days ?? 10);
  const [inactivity, setInactivity] = useState(profile?.inactivity_days ?? 7);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateProfile({
        display_name: name.trim() || null,
        default_followup_days: Math.max(0, Math.min(365, followup)),
        inactivity_days: Math.max(1, Math.min(365, inactivity)),
      });
      toast.success("Préférences enregistrées");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <SectionTitle title="Général" className="mb-4" />
        <div className="space-y-4">
          <Field label="Nom affiché">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
          </Field>

          <Field
            label="Délai de relance par défaut (jours)"
            hint="Proposé automatiquement lors de l'enregistrement d'un envoi."
          >
            <div className="flex flex-wrap items-center gap-2">
              {FOLLOWUP_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setFollowup(days)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors",
                    followup === days
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {days} jours
                </button>
              ))}
              <Input
                type="number"
                min={0}
                max={365}
                value={followup}
                onChange={(e) => setFollowup(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </Field>

          <Field
            label="Seuil d'inactivité d'une track (jours)"
            hint="Au-delà, une track est signalée comme inactive sur la page Aujourd'hui."
          >
            <Input
              type="number"
              min={1}
              max={365}
              value={inactivity}
              onChange={(e) => setInactivity(Number(e.target.value))}
              className="w-24"
            />
          </Field>

          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Enregistrer
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Couleur d'accentuation" className="mb-4" />
        <p className="mb-3 text-[13px] text-muted">
          Couleur principale de l&apos;interface. Chaque espace conserve sa propre couleur.
        </p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => void updateProfile({ accent: key })}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] capitalize transition-colors",
                profile?.accent === key
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: ACCENTS[key] }}
                aria-hidden
              />
              {key}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- Espaces -----------------------------------------------------------------

function WorkspacesTab() {
  const { workspaces, tracks, insert, update, remove } = useData();
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Workspace | null>(null);

  const sorted = useMemo(
    () => [...workspaces].sort((a, b) => a.position - b.position),
    [workspaces],
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle title="Espaces musicaux" count={sorted.length} />
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus size={16} />
          Nouvel espace
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((workspace, index) => {
          const count = tracks.filter((t) => t.workspace_id === workspace.id && !t.archived).length;
          return (
            <Card key={workspace.id} className="flex items-center gap-3 p-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: accentHex(workspace.color) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{workspace.name}</p>
                <p className="text-[12px] text-muted">
                  {count} track{count > 1 ? "s" : ""}
                  {workspace.archived ? " · archivé" : ""}
                </p>
              </div>
              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={16} />
                  </IconButton>
                )}
              >
                <MenuItem onClick={() => setEditing(workspace)}>Modifier</MenuItem>
                <MenuItem
                  disabled={index === 0}
                  onClick={() => {
                    const previous = sorted[index - 1];
                    if (!previous) return;
                    void update("workspaces", workspace.id, { position: previous.position });
                    void update("workspaces", previous.id, { position: workspace.position });
                  }}
                >
                  Monter
                </MenuItem>
                <MenuItem
                  disabled={index === sorted.length - 1}
                  onClick={() => {
                    const next = sorted[index + 1];
                    if (!next) return;
                    void update("workspaces", workspace.id, { position: next.position });
                    void update("workspaces", next.id, { position: workspace.position });
                  }}
                >
                  Descendre
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    void update("workspaces", workspace.id, { archived: !workspace.archived })
                  }
                >
                  {workspace.archived ? "Désarchiver" : "Archiver"}
                </MenuItem>
                <MenuItem destructive onClick={() => setToDelete(workspace)}>
                  Supprimer
                </MenuItem>
              </Menu>
            </Card>
          );
        })}
      </div>

      <WorkspaceModal
        open={creating || editing !== null}
        workspace={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={async (values) => {
          if (editing) await update("workspaces", editing.id, values);
          else
            await insert("workspaces", {
              ...values,
              position: sorted.length,
            });
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cet espace ?"
        destructive
        confirmLabel="Supprimer"
        message="Les tracks de cet espace ne sont pas supprimées : elles se retrouvent simplement sans espace. Préférez l'archivage pour garder l'historique."
        onConfirm={() => {
          if (toDelete) void remove("workspaces", toDelete.id);
        }}
      />
    </>
  );
}

function WorkspaceModal({
  open,
  workspace,
  onClose,
  onSave,
}: {
  open: boolean;
  workspace: Workspace | null;
  onClose: () => void;
  onSave: (values: { name: string; color: string; workflow_type: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [workflow, setWorkflow] = useState("custom");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const currentId = workspace?.id ?? null;
  if (currentId !== loadedId) {
    setLoadedId(currentId);
    setName(workspace?.name ?? "");
    setColor(workspace?.color ?? "violet");
    setWorkflow(workspace?.workflow_type ?? "custom");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={workspace ? "Modifier l'espace" : "Nouvel espace"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() =>
              void onSave({ name: name.trim(), color, workflow_type: workflow })
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Couleur d'accentuation">
          <div className="flex flex-wrap gap-2">
            {ACCENT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                onClick={() => setColor(key)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  color === key ? "scale-110 border-ink" : "border-transparent",
                )}
                style={{ backgroundColor: ACCENTS[key] }}
              />
            ))}
          </div>
        </Field>
        <Field
          label="Type de workflow"
          hint="Sert de repère pour choisir le modèle de checklist adapté."
        >
          <Select value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
            <option value="custom">Personnalisé</option>
            <option value="deepest_mind">Deepest Mind</option>
            <option value="elvik">ELVIK</option>
            <option value="remix">Remix</option>
            <option value="idees">Idées</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

// --- Pipeline ----------------------------------------------------------------

function StagesTab() {
  const { stages, tracks, insert, update, remove, insertMany } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState<Stage | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Stage | null>(null);

  const sorted = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);

  async function restoreDefaults() {
    const existing = new Set(stages.map((s) => s.key));
    const missing = DEFAULT_STAGES.filter((s) => !existing.has(s.key));
    if (missing.length === 0) {
      toast.show("Toutes les étapes par défaut sont déjà présentes.");
      return;
    }
    const base = sorted.reduce((max, s) => Math.max(max, s.position), -1);
    await insertMany(
      "stages",
      missing.map((stage, index) => ({
        key: stage.key,
        name: stage.name,
        color: stage.color,
        position: base + index + 1,
        is_sendable: Boolean(stage.is_sendable),
        is_released: Boolean(stage.is_released),
      })),
    );
    toast.success(`${missing.length} étapes ajoutées`);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title="Étapes du pipeline" count={sorted.length} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void restoreDefaults()}>
            Ajouter les étapes manquantes
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Nouvelle étape
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((stage, index) => {
          const count = tracks.filter((t) => t.stage_id === stage.id && !t.archived).length;
          return (
            <Card key={stage.id} className="flex items-center gap-3 p-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: accentHex(stage.color) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium text-ink">
                  {stage.name}
                  {stage.is_released ? <Badge tone="ok">Sortie</Badge> : null}
                  {stage.is_sendable ? <Badge tone="info">Envoyable</Badge> : null}
                  {stage.archived ? <Badge>Archivée</Badge> : null}
                </p>
                <p className="text-[12px] text-muted">
                  {count} track{count > 1 ? "s" : ""}
                </p>
              </div>
              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={16} />
                  </IconButton>
                )}
              >
                <MenuItem onClick={() => setEditing(stage)}>Modifier</MenuItem>
                <MenuItem
                  disabled={index === 0}
                  onClick={() => {
                    const previous = sorted[index - 1];
                    if (!previous) return;
                    void update("stages", stage.id, { position: previous.position });
                    void update("stages", previous.id, { position: stage.position });
                  }}
                >
                  Monter
                </MenuItem>
                <MenuItem
                  disabled={index === sorted.length - 1}
                  onClick={() => {
                    const next = sorted[index + 1];
                    if (!next) return;
                    void update("stages", stage.id, { position: next.position });
                    void update("stages", next.id, { position: stage.position });
                  }}
                >
                  Descendre
                </MenuItem>
                <MenuItem
                  onClick={() => void update("stages", stage.id, { archived: !stage.archived })}
                >
                  {stage.archived ? "Désarchiver" : "Archiver"}
                </MenuItem>
                <MenuItem destructive onClick={() => setToDelete(stage)}>
                  Supprimer
                </MenuItem>
              </Menu>
            </Card>
          );
        })}
      </div>

      <StageModal
        open={creating || editing !== null}
        stage={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={async (values) => {
          if (editing) await update("stages", editing.id, values);
          else
            await insert("stages", {
              ...values,
              key: values.name
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9]+/g, "_")
                .slice(0, 40),
              position: sorted.length,
            });
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cette étape ?"
        destructive
        confirmLabel="Supprimer"
        message="Les tracks de cette étape se retrouveront sans étape. L'archivage la retire du tableau tout en gardant l'historique."
        onConfirm={() => {
          if (toDelete) void remove("stages", toDelete.id);
        }}
      />
    </>
  );
}

function StageModal({
  open,
  stage,
  onClose,
  onSave,
}: {
  open: boolean;
  stage: Stage | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    color: string;
    is_sendable: boolean;
    is_released: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [sendable, setSendable] = useState(false);
  const [released, setReleased] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const currentId = stage?.id ?? null;
  if (currentId !== loadedId) {
    setLoadedId(currentId);
    setName(stage?.name ?? "");
    setColor(stage?.color ?? "violet");
    setSendable(stage?.is_sendable ?? false);
    setReleased(stage?.is_released ?? false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={stage ? "Modifier l'étape" : "Nouvelle étape"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() =>
              void onSave({
                name: name.trim(),
                color,
                is_sendable: sendable,
                is_released: released,
              })
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
            {ACCENT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                onClick={() => setColor(key)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  color === key ? "scale-110 border-ink" : "border-transparent",
                )}
                style={{ backgroundColor: ACCENTS[key] }}
              />
            ))}
          </div>
        </Field>
        <Checkbox
          checked={sendable}
          onChange={setSendable}
          label="Les tracks à cette étape peuvent être envoyées aux labels"
        />
        <Checkbox
          checked={released}
          onChange={setReleased}
          label="Cette étape correspond à une track sortie"
        />
      </div>
    </Modal>
  );
}

// --- Modèles de checklists ---------------------------------------------------

function TemplatesTab() {
  const { templates, templateItems, insert, insertMany, update, remove } = useData();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(templates[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newItem, setNewItem] = useState("");

  const template = templates.find((t) => t.id === selected) ?? templates[0] ?? null;
  const items = useMemo(
    () =>
      templateItems
        .filter((i) => i.template_id === template?.id)
        .sort((a, b) => a.position - b.position),
    [templateItems, template?.id],
  );

  async function restoreSeeds() {
    const existing = new Set(templates.map((t) => t.name));
    const missing = SEED_TEMPLATES.filter((t) => !existing.has(t.name));
    if (missing.length === 0) {
      toast.show("Tous les modèles fournis sont déjà présents.");
      return;
    }
    const created = await insertMany(
      "checklist_templates",
      missing.map((t) => ({
        name: t.name,
        description: t.description,
        scope: t.scope,
        workflow_key: t.workflow_key,
      })),
    );
    const byName = new Map(created.map((t) => [t.name, t]));
    await insertMany(
      "checklist_template_items",
      missing.flatMap((seed) => {
        const parent = byName.get(seed.name);
        if (!parent) return [];
        return seed.items.map((item, index) => ({
          template_id: parent.id,
          title: item.title,
          category: item.category ?? ("production" as TaskCategory),
          phase: item.phase,
          weight: item.weight ?? 1,
          estimated_minutes: item.estimated_minutes ?? null,
          position: index,
        }));
      }),
    );
    toast.success(`${missing.length} modèles restaurés`);
  }

  async function addItem() {
    if (!template || !newItem.trim()) return;
    await insert("checklist_template_items", {
      template_id: template.id,
      title: newItem.trim(),
      category: template.scope === "promotion" ? "promotion" : "production",
      phase: template.scope === "promotion" ? "promotion" : "production",
      position: items.reduce((max, i) => Math.max(max, i.position), 0) + 1,
    });
    setNewItem("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Modèles</h2>
          <IconButton label="Nouveau modèle" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
          </IconButton>
        </div>
        <ul className="space-y-0.5">
          {templates.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className={cn(
                  "w-full truncate rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                  template?.id === item.id
                    ? "bg-surface-2 text-ink"
                    : "text-muted hover:text-ink-soft",
                )}
              >
                {item.name}
                <span className="ml-1.5 text-[11px] text-faint">
                  {templateItems.filter((i) => i.template_id === item.id).length}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {templates.length === 0 ? (
          <p className="px-2 py-4 text-[12px] text-faint">Aucun modèle.</p>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => void restoreSeeds()}
        >
          Restaurer les modèles fournis
        </Button>
      </Card>

      {template ? (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold">{template.name}</h2>
              {template.description ? (
                <p className="mt-0.5 text-[13px] text-muted">{template.description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge>{template.scope}</Badge>
              <Menu
                trigger={(props) => (
                  <IconButton label="Actions" {...props}>
                    <IconMore size={16} />
                  </IconButton>
                )}
              >
                <MenuItem
                  destructive
                  onClick={() => {
                    void remove("checklist_templates", template.id);
                    setSelected(null);
                  }}
                >
                  Supprimer le modèle
                </MenuItem>
              </Menu>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink-soft">{item.title}</p>
                  <p className="text-[11px] text-faint">
                    {PHASE_LABEL[item.phase] ?? item.phase} · poids {item.weight}
                    {item.estimated_minutes ? ` · ${item.estimated_minutes} min` : ""}
                  </p>
                </div>
                <Select
                  value={item.phase}
                  onChange={(e) =>
                    void update("checklist_template_items", item.id, { phase: e.target.value })
                  }
                  className="w-auto"
                  aria-label="Phase"
                >
                  {PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {PHASE_LABEL[phase]}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={item.weight}
                  onChange={(e) =>
                    void update("checklist_template_items", item.id, {
                      weight: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-16"
                  aria-label="Poids"
                />
                <IconButton
                  label="Supprimer"
                  onClick={() => void remove("checklist_template_items", item.id)}
                >
                  <IconTrash size={15} />
                </IconButton>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addItem();
                }
              }}
              placeholder="Ajouter une tâche au modèle"
            />
            <Button variant="primary" onClick={() => void addItem()}>
              Ajouter
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center text-[13px] text-faint">
          Sélectionnez ou créez un modèle.
        </Card>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouveau modèle"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={!newName.trim()}
              onClick={() => {
                void insert("checklist_templates", { name: newName.trim() }).then((created) => {
                  setSelected(created.id);
                  setNewName("");
                  setCreating(false);
                });
              }}
            >
              Créer
            </Button>
          </>
        }
      >
        <Field label="Nom du modèle" required>
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

// --- Compte ------------------------------------------------------------------

function AccountTab() {
  const router = useRouter();
  const toast = useToast();
  const { userEmail, profile, tracks, labels, submissions, sessions } = useData();
  const [signingOut, setSigningOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  /*
   * Définir un mot de passe rend les connexions suivantes indépendantes de
   * l'e-mail : plus de lien à ouvrir, ce qui est nettement plus commode depuis
   * un téléphone.
   */
  async function savePassword() {
    if (password.length < 8) {
      setPasswordError("Huit caractères minimum.");
      return;
    }
    if (password !== confirmation) {
      setPasswordError("Les deux saisies diffèrent.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      toast.success("Mot de passe enregistré");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSavingPassword(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <SectionTitle title="Compte" className="mb-3" />
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Adresse e-mail</dt>
            <dd className="truncate text-ink-soft">{userEmail ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Nom affiché</dt>
            <dd className="text-ink-soft">{profile?.display_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Langue</dt>
            <dd className="text-ink-soft">Français</dd>
          </div>
        </dl>

        <Button variant="outline" className="mt-4" loading={signingOut} onClick={() => void signOut()}>
          <IconLogout size={16} />
          Se déconnecter
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Mot de passe" className="mb-3" />
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          Facultatif. Une fois défini, vous pourrez vous connecter directement avec votre
          adresse et ce mot de passe, sans attendre d&apos;e-mail ni ouvrir de lien — plus
          pratique sur iPhone.
        </p>
        <div className="space-y-3">
          <Field label="Nouveau mot de passe" hint="Huit caractères minimum.">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirmation" error={passwordError}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            loading={savingPassword}
            disabled={!password || !confirmation}
            onClick={() => void savePassword()}
          >
            Enregistrer le mot de passe
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Vos données" className="mb-3" />
        <dl className="space-y-2 text-[13px]">
          {[
            ["Tracks", tracks.length],
            ["Labels", labels.length],
            ["Envois", submissions.length],
            ["Sessions", sessions.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-faint">
          Toutes vos données sont stockées dans votre propre projet Supabase et isolées par votre
          identifiant utilisateur.
        </p>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <SectionTitle title={`Installer ${APP_NAME}`} className="mb-3" />
        <div className="space-y-2 text-[13px] leading-relaxed text-muted">
          <p>
            <span className="text-ink-soft">Sur iPhone :</span> ouvrez l&apos;application dans
            Safari, touchez le bouton Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </p>
          <p>
            <span className="text-ink-soft">Sur Windows :</span> dans Chrome ou Edge, cliquez
            l&apos;icône d&apos;installation à droite de la barre d&apos;adresse, ou menu ⋯ puis
            « Installer ».
          </p>
        </div>
      </Card>
    </div>
  );
}
