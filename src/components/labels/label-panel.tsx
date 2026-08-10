"use client";

import { useMemo, useState } from "react";
import {
  ALIAS_SCOPE_LABEL,
  SUBMISSION_METHOD_LABEL,
} from "@/lib/constants";
import { formatDate, plural } from "@/lib/format";
import { computeSubmissionStats } from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Badge, Button, KeyValue, Modal, SidePanel, StatTile } from "@/components/ui";
import { IconEdit, IconLink, IconMail, IconPlus } from "@/components/ui/icons";
import { SubmissionForm } from "./submission-form";
import { SubmissionList } from "./submission-list";
import type { Label } from "@/lib/types";

/** Fiche d'un label : coordonnées, préférences et historique complet des envois. */
export function LabelPanel({
  labelId,
  onClose,
  onEdit,
}: {
  labelId: string | null;
  onClose: () => void;
  onEdit: (label: Label) => void;
}) {
  const { labels, update } = useData();
  const { submissionsByLabel } = useDerived();
  const [adding, setAdding] = useState(false);

  const label = labels.find((l) => l.id === labelId) ?? null;

  const submissions = useMemo(
    () =>
      (label ? (submissionsByLabel.get(label.id) ?? []) : [])
        .slice()
        .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at)),
    [label, submissionsByLabel],
  );

  const stats = useMemo(() => computeSubmissionStats(submissions), [submissions]);

  if (!label) return null;

  const socials = Object.entries(label.socials ?? {});

  return (
    <>
      <SidePanel
        open={labelId !== null}
        onClose={onClose}
        width="lg"
        title={label.name}
        subtitle={
          [label.contact_name, label.country].filter(Boolean).join(" · ") || "Fiche label"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => void update("labels", label.id, { archived: !label.archived })}>
              {label.archived ? "Désarchiver" : "Archiver"}
            </Button>
            <Button variant="outline" onClick={() => onEdit(label)}>
              <IconEdit size={15} />
              Modifier
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <IconPlus size={15} />
              Nouvel envoi
            </Button>
          </>
        }
      >
        <div className="space-y-5 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Envois" value={stats.sent} />
            <StatTile label="Réponses" value={stats.responded} />
            <StatTile
              label="Taux de réponse"
              value={stats.sent === 0 ? "—" : `${Math.round(stats.responseRate)} %`}
            />
            <StatTile label="Positives" value={stats.positive} tone="ok" />
            <StatTile label="Refus" value={stats.negative} />
            <StatTile
              label="Délai moyen"
              value={
                stats.averageResponseDays === null
                  ? "—"
                  : plural(Math.round(stats.averageResponseDays), "jour")
              }
            />
          </div>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Coordonnées
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Contact">{label.contact_name ?? "—"}</KeyValue>
              <KeyValue label="Pays">{label.country ?? "—"}</KeyValue>
              <KeyValue label="E-mail">
                {label.email ? (
                  <a href={`mailto:${label.email}`} className="text-accent hover:underline">
                    {label.email}
                  </a>
                ) : (
                  "—"
                )}
              </KeyValue>
              <KeyValue label="E-mail secondaire">{label.email_secondary ?? "—"}</KeyValue>
              <KeyValue label="Méthode préférée">
                {SUBMISSION_METHOD_LABEL[label.preferred_method]}
              </KeyValue>
              <KeyValue label="Alias">{ALIAS_SCOPE_LABEL[label.alias_scope]}</KeyValue>
              <KeyValue label="Délai de réponse habituel">
                {label.typical_response_days ? plural(label.typical_response_days, "jour") : "—"}
              </KeyValue>
              <KeyValue label="Relances">
                {label.allows_followup ? "Autorisées" : "À éviter"}
              </KeyValue>
              <KeyValue label="Dernière interaction">
                {stats.lastInteraction ? formatDate(stats.lastInteraction) : "—"}
              </KeyValue>
              <KeyValue label="Genres acceptés">
                {label.genres.length > 0 ? label.genres.join(", ") : "—"}
              </KeyValue>
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {label.website ? (
                <a
                  href={label.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft hover:border-line-strong"
                >
                  <IconLink size={14} />
                  Site
                </a>
              ) : null}
              {label.demo_form_url ? (
                <a
                  href={label.demo_form_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft hover:border-line-strong"
                >
                  <IconLink size={14} />
                  Formulaire de démo
                </a>
              ) : null}
              {label.email ? (
                <a
                  href={`mailto:${label.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft hover:border-line-strong"
                >
                  <IconMail size={14} />
                  Écrire
                </a>
              ) : null}
              {socials.map(([network, value]) => (
                <a
                  key={network}
                  href={value.startsWith("http") ? value : `https://${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft hover:border-line-strong"
                >
                  {network}
                </a>
              ))}
            </div>
          </section>

          {label.notes ? (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                Notes personnelles
              </h3>
              <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                {label.notes}
              </p>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Historique des envois
              <Badge>{submissions.length}</Badge>
            </h3>
            <SubmissionList
              submissions={submissions}
              show="track"
              emptyMessage="Aucune track n'a encore été envoyée à ce label."
            />
          </section>
        </div>
      </SidePanel>

      <Modal open={adding} onClose={() => setAdding(false)} title="Nouvel envoi" size="lg">
        <SubmissionForm
          defaultLabelId={label.id}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </>
  );
}
