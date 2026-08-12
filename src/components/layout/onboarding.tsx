"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCENT_KEYS,
  APP_NAME,
  DEFAULT_STAGES,
  DEFAULT_WORKSPACES,
  FOLLOWUP_PRESETS,
  accentHex,
} from "@/lib/constants";
import { SEED_TEMPLATES } from "@/lib/domain/templates";
import { useData } from "@/lib/store/data";
import { Button, Checkbox, Field, Input, Select, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { IconMusic } from "@/components/ui/icons";

interface DraftWorkspace {
  name: string;
  color: string;
  workflow_type: string;
  enabled: boolean;
}

interface DraftStage {
  key: string;
  name: string;
  color: string;
  enabled: boolean;
  is_sendable: boolean;
  is_released: boolean;
}

/**
 * Amorçage du compte : quatre écrans, aucune étape inutile.
 * Tout ce qui est choisi ici reste modifiable dans les Paramètres.
 */
export function Onboarding() {
  const router = useRouter();
  const toast = useToast();
  const { insertMany, insert, updateProfile, profile } = useData();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [workspaces, setWorkspaces] = useState<DraftWorkspace[]>(
    DEFAULT_WORKSPACES.map((w) => ({ ...w, enabled: true })),
  );
  const [stages, setStages] = useState<DraftStage[]>(
    DEFAULT_STAGES.map((s) => ({
      key: s.key,
      name: s.name,
      color: s.color,
      enabled: true,
      is_sendable: Boolean(s.is_sendable),
      is_released: Boolean(s.is_released),
    })),
  );
  const [followupDays, setFollowupDays] = useState(profile?.default_followup_days ?? 10);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackWorkspace, setTrackWorkspace] = useState(0);
  const [labelsText, setLabelsText] = useState("");

  const enabledWorkspaces = workspaces.filter((w) => w.enabled);
  const enabledStages = stages.filter((s) => s.enabled);

  async function finish() {
    if (enabledWorkspaces.length === 0 || enabledStages.length === 0) {
      toast.error("Gardez au moins un alias et une étape.");
      return;
    }
    setBusy(true);
    try {
      const createdWorkspaces = await insertMany(
        "workspaces",
        enabledWorkspaces.map((w, index) => ({
          name: w.name.trim(),
          color: w.color,
          workflow_type: w.workflow_type,
          position: index,
        })),
      );

      const createdStages = await insertMany(
        "stages",
        enabledStages.map((s, index) => ({
          key: s.key,
          name: s.name.trim(),
          color: s.color,
          position: index,
          is_sendable: s.is_sendable,
          is_released: s.is_released,
        })),
      );

      // Modèles de checklists : créés systématiquement, modifiables ensuite.
      const createdTemplates = await insertMany(
        "checklist_templates",
        SEED_TEMPLATES.map((t) => ({
          name: t.name,
          description: t.description,
          scope: t.scope,
          workflow_key: t.workflow_key,
        })),
      );
      const templateByName = new Map(createdTemplates.map((t) => [t.name, t]));
      await insertMany(
        "checklist_template_items",
        SEED_TEMPLATES.flatMap((template) => {
          const created = templateByName.get(template.name);
          if (!created) return [];
          return template.items.map((item, index) => ({
            template_id: created.id,
            title: item.title,
            category: item.category ?? "production",
            phase: item.phase,
            weight: item.weight ?? 1,
            estimated_minutes: item.estimated_minutes ?? null,
            position: index,
          }));
        }),
      );

      if (trackTitle.trim()) {
        const workspace = createdWorkspaces[Math.min(trackWorkspace, createdWorkspaces.length - 1)];
        await insert("tracks", {
          title: trackTitle.trim(),
          workspace_id: workspace?.id ?? null,
          stage_id: createdStages[0]?.id ?? null,
          position: 0,
        });
      }

      const labelNames = labelsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (labelNames.length > 0) {
        await insertMany(
          "labels",
          labelNames.map((line) => {
            // « Nom du label, contact@label.com »
            const [name, email] = line.split(/[,;]/).map((part) => part.trim());
            return { name: name || line, email: email || null };
          }),
        );
      }

      await updateProfile({ default_followup_days: followupDays, onboarding_done: true });
      toast.success("Tout est prêt.");
      router.push("/studio");
    } catch {
      // Le message d'erreur détaillé est déjà affiché par la couche de données.
      setBusy(false);
    }
  }

  const steps = ["Alias", "Pipeline", "Relances", "Première track"];

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-10">
      <div className="w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconMusic size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Bienvenue dans {APP_NAME}</h1>
            <p className="text-sm text-muted">
              Quatre réglages rapides, modifiables à tout moment.
            </p>
          </div>
        </header>

        <ol className="mb-6 flex items-center gap-2">
          {steps.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= step ? "bg-accent" : "bg-surface-3",
                )}
              />
            </li>
          ))}
        </ol>

        <div className="card p-5">
          {step === 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Vos alias</h2>
                <p className="mt-1 text-sm text-muted">
                  Un alias par identité ou par type de projet. Décochez ce dont vous n&apos;avez
                  pas besoin.
                </p>
              </div>
              <div className="space-y-2">
                {workspaces.map((workspace, index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <Checkbox
                      checked={workspace.enabled}
                      onChange={(checked) =>
                        setWorkspaces((prev) =>
                          prev.map((w, i) => (i === index ? { ...w, enabled: checked } : w)),
                        )
                      }
                    />
                    <Input
                      value={workspace.name}
                      onChange={(e) =>
                        setWorkspaces((prev) =>
                          prev.map((w, i) => (i === index ? { ...w, name: e.target.value } : w)),
                        )
                      }
                      className="flex-1"
                      disabled={!workspace.enabled}
                    />
                    <ColorPicker
                      value={workspace.color}
                      onChange={(color) =>
                        setWorkspaces((prev) =>
                          prev.map((w, i) => (i === index ? { ...w, color } : w)),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setWorkspaces((prev) => [
                    ...prev,
                    { name: "", color: "violet", workflow_type: "custom", enabled: true },
                  ])
                }
              >
                Ajouter un alias
              </Button>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Les étapes de votre pipeline</h2>
                <p className="mt-1 text-sm text-muted">
                  L&apos;ordre et les noms restent modifiables depuis les Paramètres.
                </p>
              </div>
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div key={stage.key} className="flex items-center gap-2.5">
                    <Checkbox
                      checked={stage.enabled}
                      onChange={(checked) =>
                        setStages((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, enabled: checked } : s)),
                        )
                      }
                    />
                    <Input
                      value={stage.name}
                      onChange={(e) =>
                        setStages((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                        )
                      }
                      className="flex-1"
                      disabled={!stage.enabled}
                    />
                    <ColorPicker
                      value={stage.color}
                      onChange={(color) =>
                        setStages((prev) => prev.map((s, i) => (i === index ? { ...s, color } : s)))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Relances des labels</h2>
                <p className="mt-1 text-sm text-muted">
                  Délai proposé par défaut après un envoi. Aucun e-mail n&apos;est jamais envoyé
                  automatiquement : l&apos;application crée uniquement un rappel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FOLLOWUP_PRESETS.map((days) => (
                  <Button
                    key={days}
                    variant={followupDays === days ? "primary" : "outline"}
                    onClick={() => setFollowupDays(days)}
                  >
                    {days} jours
                  </Button>
                ))}
                <Button
                  variant={followupDays === 0 ? "primary" : "outline"}
                  onClick={() => setFollowupDays(0)}
                >
                  Aucune relance
                </Button>
              </div>
              <Field label="Délai personnalisé (jours)" className="max-w-40">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={followupDays}
                  onChange={(e) => setFollowupDays(Number(e.target.value))}
                />
              </Field>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Votre première track</h2>
                <p className="mt-1 text-sm text-muted">
                  Facultatif — vous pourrez en créer à tout moment.
                </p>
              </div>
              <Field label="Titre">
                <Input
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="Nom de la track ou de l'idée"
                />
              </Field>
              {enabledWorkspaces.length > 0 ? (
                <Field label="Alias">
                  <Select
                    value={trackWorkspace}
                    onChange={(e) => setTrackWorkspace(Number(e.target.value))}
                  >
                    {enabledWorkspaces.map((workspace, index) => (
                      <option key={index} value={index}>
                        {workspace.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field
                label="Quelques labels"
                hint="Un par ligne. Vous pouvez ajouter l'e-mail après une virgule."
              >
                <textarea
                  value={labelsText}
                  onChange={(e) => setLabelsText(e.target.value)}
                  rows={4}
                  placeholder={"Label A, demo@labela.com\nLabel B"}
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </Field>
            </section>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">
              Étape {step + 1} sur {steps.length}
            </span>
            {step < steps.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Continuer
              </Button>
            ) : (
              <Button variant="primary" loading={busy} onClick={() => void finish()}>
                Terminer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {ACCENT_KEYS.slice(0, 6).map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key}
          onClick={() => onChange(key)}
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-transform",
            value === key ? "border-ink scale-110" : "border-transparent",
          )}
          style={{ backgroundColor: accentHex(key) }}
        />
      ))}
    </div>
  );
}
