"use client";

import { useState } from "react";
import { ALIAS_SCOPE_LABEL, SUBMISSION_METHOD_LABEL } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { AliasScope, Label, SubmissionMethod } from "@/lib/types";

interface LabelDraft {
  name: string;
  contact_name: string;
  email: string;
  email_secondary: string;
  country: string;
  website: string;
  demo_form_url: string;
  preferred_method: SubmissionMethod;
  genres: string;
  alias_scope: AliasScope;
  instagram: string;
  soundcloud: string;
  spotify: string;
  typical_response_days: string;
  allows_followup: boolean;
  notes: string;
}

function draftFrom(label?: Label): LabelDraft {
  const socials = label?.socials ?? {};
  return {
    name: label?.name ?? "",
    contact_name: label?.contact_name ?? "",
    email: label?.email ?? "",
    email_secondary: label?.email_secondary ?? "",
    country: label?.country ?? "",
    website: label?.website ?? "",
    demo_form_url: label?.demo_form_url ?? "",
    preferred_method: label?.preferred_method ?? "email",
    genres: (label?.genres ?? []).join(", "),
    alias_scope: label?.alias_scope ?? "les_deux",
    instagram: socials.instagram ?? "",
    soundcloud: socials.soundcloud ?? "",
    spotify: socials.spotify ?? "",
    typical_response_days:
      label?.typical_response_days !== null && label?.typical_response_days !== undefined
        ? String(label.typical_response_days)
        : "",
    allows_followup: label?.allows_followup ?? true,
    notes: label?.notes ?? "",
  };
}

export function LabelForm({
  label,
  onDone,
  onCancel,
}: {
  label?: Label;
  onDone: (labelId: string) => void;
  onCancel?: () => void;
}) {
  const { insert, update, log } = useData();
  const toast = useToast();
  const [draft, setDraft] = useState<LabelDraft>(() => draftFrom(label));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof LabelDraft>(key: K, value: LabelDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    if (!draft.name.trim()) {
      setError("Le nom du label est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);

    const socials: Record<string, string> = {};
    if (draft.instagram.trim()) socials.instagram = draft.instagram.trim();
    if (draft.soundcloud.trim()) socials.soundcloud = draft.soundcloud.trim();
    if (draft.spotify.trim()) socials.spotify = draft.spotify.trim();

    const days = draft.typical_response_days.trim();
    const values = {
      name: draft.name.trim(),
      contact_name: draft.contact_name.trim() || null,
      email: draft.email.trim() || null,
      email_secondary: draft.email_secondary.trim() || null,
      country: draft.country.trim() || null,
      website: draft.website.trim() || null,
      demo_form_url: draft.demo_form_url.trim() || null,
      preferred_method: draft.preferred_method,
      genres: draft.genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      alias_scope: draft.alias_scope,
      socials,
      typical_response_days: days === "" ? null : Number(days),
      allows_followup: draft.allows_followup,
      notes: draft.notes.trim() || null,
    };

    try {
      if (label) {
        await update("labels", label.id, values);
        onDone(label.id);
      } else {
        const created = await insert("labels", values);
        log({
          entity_type: "label",
          entity_id: created.id,
          action: "label_cree",
          summary: `Label « ${created.name} » ajouté`,
        });
        toast.success(`« ${created.name} » ajouté`);
        onDone(created.id);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Nom du label" required error={error}>
        <Input autoFocus value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact">
          <Input
            value={draft.contact_name}
            onChange={(e) => set("contact_name", e.target.value)}
            placeholder="Prénom ou nom du responsable A&R"
          />
        </Field>
        <Field label="Pays">
          <Input value={draft.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail">
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="demo@label.com"
          />
        </Field>
        <Field label="E-mail secondaire">
          <Input
            type="email"
            value={draft.email_secondary}
            onChange={(e) => set("email_secondary", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site internet">
          <Input
            value={draft.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field label="Formulaire de démo">
          <Input
            value={draft.demo_form_url}
            onChange={(e) => set("demo_form_url", e.target.value)}
            placeholder="https://"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Méthode d'envoi préférée">
          <Select
            value={draft.preferred_method}
            onChange={(e) => set("preferred_method", e.target.value as SubmissionMethod)}
          >
            {(Object.keys(SUBMISSION_METHOD_LABEL) as SubmissionMethod[]).map((method) => (
              <option key={method} value={method}>
                {SUBMISSION_METHOD_LABEL[method]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Alias correspondant">
          <Select
            value={draft.alias_scope}
            onChange={(e) => set("alias_scope", e.target.value as AliasScope)}
          >
            {(Object.keys(ALIAS_SCOPE_LABEL) as AliasScope[]).map((scope) => (
              <option key={scope} value={scope}>
                {ALIAS_SCOPE_LABEL[scope]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Genres acceptés" hint="Séparés par des virgules">
        <Input
          value={draft.genres}
          onChange={(e) => set("genres", e.target.value)}
          placeholder="melodic techno, progressive"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Instagram">
          <Input value={draft.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </Field>
        <Field label="SoundCloud">
          <Input value={draft.soundcloud} onChange={(e) => set("soundcloud", e.target.value)} />
        </Field>
        <Field label="Spotify">
          <Input value={draft.spotify} onChange={(e) => set("spotify", e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Délai de réponse habituel (jours)">
          <Input
            type="number"
            min={0}
            value={draft.typical_response_days}
            onChange={(e) => set("typical_response_days", e.target.value)}
          />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            checked={draft.allows_followup}
            onChange={(checked) => set("allows_followup", checked)}
            label="Autorise les relances"
          />
        </div>
      </div>

      <Field label="Notes personnelles">
        <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {label ? "Enregistrer" : "Ajouter le label"}
        </Button>
      </div>
    </form>
  );
}
