"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { submissionTiming } from "@/lib/domain/submissions";
import { useDebounced, useLocalState } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import {
  Badge,
  Button,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  SearchInput,
  Select,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus } from "@/components/ui/icons";
import { LabelForm } from "@/components/labels/label-form";
import { RespondedDialog } from "@/components/labels/responded-dialog";
import { LabelPanel } from "@/components/labels/label-panel";
import type { Label, LabelSubmission } from "@/lib/types";

const TIMING_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-muted",
  neutre: "text-faint",
};

export default function LabelsPage() {
  return (
    <Suspense fallback={null}>
      <LabelsContent />
    </Suspense>
  );
}

/** Une ligne du carnet : le label et son envoi le plus récent. */
interface Row {
  label: Label;
  last: LabelSubmission | undefined;
  trackTitle: string | null;
}

function LabelsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { labels, tracks, update } = useData();
  const { submissionsByLabel, dueFollowups } = useDerived();

  const [search, setSearch] = useState("");
  const query = useDebounced(search, 180);
  const [styleFilter, setStyleFilter] = useLocalState("atelier.labels.style", "tous");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [responding, setResponding] = useState<LabelSubmission | null>(null);

  const openLabelId = params.get("label");

  const styles = useMemo(
    () => [...new Set(labels.flatMap((l) => l.genres))].sort((a, b) => a.localeCompare(b, "fr")),
    [labels],
  );

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    return labels
      .filter((label) => {
        if (label.archived) return false;
        if (styleFilter !== "tous" && !label.genres.includes(styleFilter)) return false;
        if (q) {
          const haystack =
            `${label.name} ${label.contact_name ?? ""} ${label.email ?? ""} ${label.genres.join(" ")}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((label) => {
        const last = (submissionsByLabel.get(label.id) ?? [])
          .filter((s) => !s.archived)
          .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at))[0];
        return {
          label,
          last,
          trackTitle: last ? (tracks.find((t) => t.id === last.track_id)?.title ?? null) : null,
        };
      });
  }, [labels, query, styleFilter, submissionsByLabel, tracks]);

  function openLabel(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("label", id);
    else next.delete("label");
    router.replace(`/labels${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }

  /** Cocher « Répondu » ouvre la fenêtre ; décocher efface la réponse. */
  function setResponded(submission: LabelSubmission, checked: boolean) {
    if (checked) setResponding(submission);
    else
      void update("label_submissions", submission.id, {
        responded_at: null,
        response_type: null,
        status: "en_attente",
      });
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight">Labels</h1>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Ajouter un label
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Nom, contact, e-mail…"
            className="w-full sm:w-64"
          />
          <Select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="w-auto"
            wrapperClassName="shrink-0"
            aria-label="Style"
          >
            <option value="tous">Tous les styles</option>
            {styles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {dueFollowups.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">À relancer</h2>
          <ul className="space-y-1.5">
            {dueFollowups.slice(0, 4).map((submission) => {
              const label = labels.find((l) => l.id === submission.label_id);
              const track = tracks.find((t) => t.id === submission.track_id);
              return (
                <li
                  key={submission.id}
                  className="card flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3"
                >
                  <span className="text-[14px] font-medium text-ink">
                    {label?.name ?? "Label"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                    {track?.title ?? "—"} · {submissionTiming(submission).label}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openLabel(submission.label_id)}>
                    Voir
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-3 text-[14px] text-muted">
          {query.trim() || styleFilter !== "tous"
            ? "Aucun label ne correspond."
            : "Aucun label pour le moment."}
          {query.trim() || styleFilter !== "tous" ? null : (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              Ajouter ton premier label
            </Button>
          )}
        </p>
      ) : (
        <>
          {/* Ordinateur : un vrai tableau, lisible d'un coup d'œil */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5 font-medium">Label</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium">Styles</th>
                  <th className="px-3 py-2.5 font-medium">Dernière track</th>
                  <th className="px-3 py-2.5 font-medium">Envoi</th>
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                  <th className="px-3 py-2.5 font-medium">Suivi</th>
                  <th className="px-3 py-2.5 font-medium">Répondu</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ label, last, trackTitle }) => {
                  const timing = last ? submissionTiming(last) : null;
                  return (
                    <tr
                      key={label.id}
                      className="border-b border-line last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openLabel(label.id)}
                          className="text-left text-[14px] font-medium text-ink hover:text-accent-ink"
                        >
                          {label.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {label.contact_name ?? "—"}
                        {label.email ? (
                          <p className="truncate text-[11px] text-faint">{label.email}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {label.genres.length > 0 ? label.genres.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-3 text-muted">{trackTitle ?? "—"}</td>
                      <td className="px-3 py-3 text-muted">
                        {last?.sent_at ? formatDate(last.sent_at, "d MMM yyyy") : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {last ? (
                          <Badge tone={SUBMISSION_STATUS_TONE[last.status]}>
                            {SUBMISSION_STATUS_LABEL[last.status]}
                          </Badge>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className={cn("px-3 py-3", timing ? TIMING_TONE[timing.tone] : "text-faint")}>
                        {timing ? timing.label : "Jamais contacté"}
                      </td>
                      <td className="px-3 py-3">
                        {last ? (
                          <Checkbox
                            checked={last.responded}
                            onChange={(checked) => setResponded(last, checked)}
                          />
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <RowMenu
                          label={label}
                          onOpen={() => openLabel(label.id)}
                          onEdit={() => setEditing(label)}
                          onArchive={() =>
                            void update("labels", label.id, { archived: !label.archived })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile : la même information, empilée */}
          <ul className="space-y-2 lg:hidden">
            {rows.map(({ label, last, trackTitle }) => {
              const timing = last ? submissionTiming(last) : null;
              return (
                <li key={label.id} className="card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openLabel(label.id)}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {label.name}
                      </span>
                      <span className="block truncate text-[12px] text-faint">
                        {[label.contact_name, label.genres.join(", ")].filter(Boolean).join(" · ") ||
                          "—"}
                      </span>
                    </button>
                    <RowMenu
                      label={label}
                      onOpen={() => openLabel(label.id)}
                      onEdit={() => setEditing(label)}
                      onArchive={() =>
                        void update("labels", label.id, { archived: !label.archived })
                      }
                    />
                  </div>

                  {last ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-2.5">
                      <span className="text-[13px] text-ink-soft">{trackTitle ?? "—"}</span>
                      <Badge tone={SUBMISSION_STATUS_TONE[last.status]}>
                        {SUBMISSION_STATUS_LABEL[last.status]}
                      </Badge>
                      <span className={cn("text-[12px]", timing ? TIMING_TONE[timing.tone] : "")}>
                        {timing?.label}
                      </span>
                      <Checkbox
                        className="ml-auto"
                        checked={last.responded}
                        onChange={(checked) => setResponded(last, checked)}
                        label={<span className="text-[12px] text-muted">Répondu</span>}
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-faint">Jamais contacté</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau label" size="lg">
        <LabelForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Modifier le label"
        size="lg"
      >
        {editing ? (
          <LabelForm
            label={editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <RespondedDialog
        submission={responding}
        open={responding !== null}
        onClose={() => setResponding(null)}
      />

      <LabelPanel
        labelId={openLabelId}
        onClose={() => openLabel(null)}
        onEdit={(label) => {
          openLabel(null);
          setEditing(label);
        }}
      />
    </div>
  );
}

function RowMenu({
  label,
  onOpen,
  onEdit,
  onArchive,
}: {
  label: Label;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <Menu
      trigger={(props) => (
        <IconButton label="Actions" {...props}>
          <IconMore size={16} />
        </IconButton>
      )}
    >
      <MenuItem onClick={onOpen}>Voir la fiche</MenuItem>
      <MenuItem onClick={onEdit}>Modifier</MenuItem>
      <MenuItem onClick={onArchive}>{label.archived ? "Désarchiver" : "Archiver"}</MenuItem>
    </Menu>
  );
}
