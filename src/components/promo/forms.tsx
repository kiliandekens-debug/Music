"use client";

import { useState } from "react";
import {
  CONTACT_CATEGORY_LABEL,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_OPTIONS,
  PLATFORM_LABEL,
  SUPPORT_TYPE_LABEL,
} from "@/lib/constants";
import { todayIso } from "@/lib/format";
import { useData } from "@/lib/store/data";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type {
  ContactCategory,
  ContentItem,
  ContentStatus,
  Platform,
  PromotionContact,
  PromotionOutreach,
  ReleaseMetric,
  SupportType,
} from "@/lib/types";

// --- Contact promotionnel ----------------------------------------------------

export function ContactForm({
  contact,
  onDone,
  onCancel,
}: {
  contact?: PromotionContact;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { insert, update } = useData();
  const toast = useToast();
  const [name, setName] = useState(contact?.name ?? "");
  const [category, setCategory] = useState<ContactCategory>(contact?.category ?? "dj");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [url, setUrl] = useState(contact?.url ?? "");
  const [country, setCountry] = useState(contact?.country ?? "");
  const [platform, setPlatform] = useState(contact?.platform ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const values = {
      name: name.trim(),
      category,
      email: email.trim() || null,
      url: url.trim() || null,
      country: country.trim() || null,
      platform: platform.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (contact) await update("promotion_contacts", contact.id, values);
      else {
        await insert("promotion_contacts", values);
        toast.success("Contact ajouté");
      }
      onDone();
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
      <Field label="Nom" required>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as ContactCategory)}
          >
            {(Object.keys(CONTACT_CATEGORY_LABEL) as ContactCategory[]).map((c) => (
              <option key={c} value={c}>
                {CONTACT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pays">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Lien">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </Field>
      </div>
      <Field label="Plateforme">
        <Input
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="Instagram, Spotify, radio locale…"
        />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {contact ? "Enregistrer" : "Ajouter le contact"}
        </Button>
      </div>
    </form>
  );
}

// --- Envoi promotionnel ------------------------------------------------------

export function OutreachForm({
  outreach,
  defaultTrackId,
  defaultContactId,
  onDone,
  onCancel,
}: {
  outreach?: PromotionOutreach;
  defaultTrackId?: string;
  defaultContactId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { tracks, contacts, campaigns, insert, update, insert: insertRow } = useData();
  const toast = useToast();
  const availableTracks = tracks.filter((t) => !t.archived);
  const availableContacts = contacts.filter((c) => !c.archived);

  const [contactId, setContactId] = useState(
    outreach?.contact_id ?? defaultContactId ?? availableContacts[0]?.id ?? "",
  );
  const [trackId, setTrackId] = useState(
    outreach?.track_id ?? defaultTrackId ?? availableTracks[0]?.id ?? "",
  );
  const [sentAt, setSentAt] = useState(outreach?.sent_at ?? todayIso());
  const [linkSent, setLinkSent] = useState(outreach?.link_sent ?? "");
  const [respondedAt, setRespondedAt] = useState(outreach?.responded_at ?? "");
  const [supportType, setSupportType] = useState<SupportType>(outreach?.support_type ?? "aucun");
  const [followupDate, setFollowupDate] = useState(outreach?.followup_date ?? "");
  const [comment, setComment] = useState(outreach?.comment ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!contactId || !trackId) return;
    setBusy(true);
    const campaign = campaigns.find((c) => c.track_id === trackId);
    const values = {
      contact_id: contactId,
      track_id: trackId,
      campaign_id: campaign?.id ?? null,
      sent_at: sentAt || null,
      link_sent: linkSent.trim() || null,
      responded_at: respondedAt || null,
      support_type: supportType,
      followup_date: followupDate || null,
      comment: comment.trim() || null,
    };
    try {
      if (outreach) await update("promotion_outreach", outreach.id, values);
      else {
        const created = await insert("promotion_outreach", values);
        if (followupDate) {
          const contact = contacts.find((c) => c.id === contactId);
          await insertRow("reminders", {
            track_id: trackId,
            title: `Relancer ${contact?.name ?? "le contact"}`,
            kind: "promo",
            entity_type: "promotion_outreach",
            entity_id: created.id,
            due_at: new Date(`${followupDate}T09:00:00`).toISOString(),
          });
        }
        toast.success("Envoi promo enregistré");
      }
      onDone();
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact" required>
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">—</option>
            {availableContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {CONTACT_CATEGORY_LABEL[c.category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Track" required>
          <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            <option value="">—</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date d'envoi">
          <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
        </Field>
        <Field label="Date de relance">
          <Input
            type="date"
            value={followupDate}
            onChange={(e) => setFollowupDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Lien envoyé">
        <Input value={linkSent} onChange={(e) => setLinkSent(e.target.value)} placeholder="https://" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de réponse">
          <Input
            type="date"
            value={respondedAt}
            onChange={(e) => setRespondedAt(e.target.value)}
          />
        </Field>
        <Field label="Type de soutien">
          <Select
            value={supportType}
            onChange={(e) => setSupportType(e.target.value as SupportType)}
          >
            {(Object.keys(SUPPORT_TYPE_LABEL) as SupportType[]).map((s) => (
              <option key={s} value={s}>
                {SUPPORT_TYPE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Commentaire">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      </Field>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {outreach ? "Enregistrer" : "Enregistrer l'envoi"}
        </Button>
      </div>
    </form>
  );
}

// --- Contenu planifié --------------------------------------------------------

export function ContentForm({
  item,
  defaultTrackId,
  defaultDate,
  onDone,
  onCancel,
}: {
  item?: ContentItem;
  defaultTrackId?: string;
  defaultDate?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { tracks, campaigns, insert, update } = useData();
  const toast = useToast();
  const availableTracks = tracks.filter((t) => !t.archived);

  const [trackId, setTrackId] = useState(item?.track_id ?? defaultTrackId ?? "");
  const [platform, setPlatform] = useState<Platform>(item?.platform ?? "instagram");
  const [title, setTitle] = useState(item?.title ?? "");
  const [contentType, setContentType] = useState(item?.content_type ?? "Post");
  const [scheduledAt, setScheduledAt] = useState(
    item?.scheduled_at
      ? item.scheduled_at.slice(0, 16)
      : defaultDate
        ? `${defaultDate}T18:00`
        : "",
  );
  const [status, setStatus] = useState<ContentStatus>(item?.status ?? "idee");
  const [caption, setCaption] = useState(item?.caption ?? "");
  const [publishedUrl, setPublishedUrl] = useState(item?.published_url ?? "");
  const [results, setResults] = useState(item?.results ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const campaign = trackId ? campaigns.find((c) => c.track_id === trackId) : undefined;
    const values = {
      track_id: trackId || null,
      campaign_id: campaign?.id ?? null,
      platform,
      title: title.trim(),
      content_type: contentType || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status,
      caption: caption.trim() || null,
      published_url: publishedUrl.trim() || null,
      results: results.trim() || null,
    };
    try {
      if (item) await update("content_calendar", item.id, values);
      else {
        await insert("content_calendar", values);
        toast.success("Contenu planifié");
      }
      onDone();
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
      <Field label="Titre" required>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plateforme">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type de contenu">
          <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
            {CONTENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date et heure prévues">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </Field>
        <Field label="Statut">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
            {(Object.keys(CONTENT_STATUS_LABEL) as ContentStatus[]).map((s) => (
              <option key={s} value={s}>
                {CONTENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Track liée">
        <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
          <option value="">—</option>
          {availableTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Texte ou légende">
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
      </Field>

      {status === "publie" ? (
        <>
          <Field label="Lien après publication">
            <Input
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="Résultats">
            <Textarea value={results} onChange={(e) => setResults(e.target.value)} rows={2} />
          </Field>
        </>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {item ? "Enregistrer" : "Planifier"}
        </Button>
      </div>
    </form>
  );
}

// --- Relevé de résultats -----------------------------------------------------

const METRIC_FIELDS: { key: keyof ReleaseMetric; label: string; money?: boolean }[] = [
  { key: "spotify_streams", label: "Streams Spotify" },
  { key: "spotify_listeners", label: "Auditeurs" },
  { key: "saves", label: "Sauvegardes" },
  { key: "playlist_adds", label: "Ajouts en playlist" },
  { key: "youtube_views", label: "Vues YouTube" },
  { key: "soundcloud_plays", label: "Écoutes SoundCloud" },
  { key: "downloads", label: "Téléchargements" },
  { key: "sales", label: "Ventes" },
  { key: "reposts", label: "Reposts" },
  { key: "dj_supports", label: "DJ supports" },
  { key: "radio_plays", label: "Passages radio" },
  { key: "ad_spend", label: "Dépenses publicitaires", money: true },
  { key: "other_spend", label: "Autres dépenses", money: true },
  { key: "revenue", label: "Revenus connus", money: true },
];

export function MetricForm({
  metric,
  defaultTrackId,
  onDone,
  onCancel,
}: {
  metric?: ReleaseMetric;
  defaultTrackId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { tracks, campaigns, insert, update } = useData();
  const toast = useToast();
  const availableTracks = tracks.filter((t) => !t.archived);

  const [trackId, setTrackId] = useState(
    metric?.track_id ?? defaultTrackId ?? availableTracks[0]?.id ?? "",
  );
  const [measuredOn, setMeasuredOn] = useState(metric?.measured_on ?? todayIso());
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of METRIC_FIELDS) {
      const value = metric?.[field.key];
      initial[field.key as string] =
        value === null || value === undefined ? "" : String(value);
    }
    return initial;
  });
  const [notes, setNotes] = useState(metric?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!trackId) {
      setError("Choisissez une track.");
      return;
    }
    setBusy(true);
    setError(null);
    const campaign = campaigns.find((c) => c.track_id === trackId);
    const payload: Record<string, unknown> = {
      track_id: trackId,
      campaign_id: campaign?.id ?? null,
      measured_on: measuredOn,
      notes: notes.trim() || null,
    };
    for (const field of METRIC_FIELDS) {
      const raw = values[field.key as string]?.trim();
      payload[field.key as string] = raw ? Number(raw.replace(",", ".")) : null;
    }

    try {
      if (metric) await update("release_metrics", metric.id, payload);
      else {
        await insert("release_metrics", payload);
        toast.success("Résultats enregistrés");
      }
      onDone();
    } catch (e) {
      // Contrainte d'unicité (track, date) : un seul relevé par jour et par track.
      const message = e instanceof Error ? e.message : "";
      if (message.includes("duplicate key")) {
        setError("Un relevé existe déjà pour cette track à cette date. Modifiez-le plutôt.");
      }
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Track" required error={error}>
          <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            <option value="">—</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date du relevé">
          <Input
            type="date"
            value={measuredOn}
            onChange={(e) => setMeasuredOn(e.target.value)}
          />
        </Field>
      </div>

      <p className="text-[12px] text-faint">
        Saisie manuelle. Laissez vide ce que vous ne suivez pas : rien n&apos;est estimé
        automatiquement.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {METRIC_FIELDS.map((field) => (
          <Field key={field.key as string} label={field.label}>
            <Input
              inputMode="decimal"
              value={values[field.key as string] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key as string]: e.target.value }))
              }
              placeholder={field.money ? "€" : ""}
            />
          </Field>
        ))}
      </div>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {metric ? "Enregistrer" : "Ajouter le relevé"}
        </Button>
      </div>
    </form>
  );
}
