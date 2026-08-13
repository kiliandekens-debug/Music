"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDate, plural } from "@/lib/format";
import { submissionTiming } from "@/lib/domain/submissions";
import { useDebounced, useLocalState } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import {
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
import { PageHeader } from "@/components/layout/page-header";
import { LabelForm } from "@/components/labels/label-form";
import { RespondedDialog } from "@/components/labels/responded-dialog";
import { LabelPanel } from "@/components/labels/label-panel";
import type { Label, LabelSubmission } from "@/lib/types";

const DOT_TONE: Record<string, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  ok: "bg-ok",
  info: "bg-line-strong",
  neutre: "bg-line-strong",
};

const TIMING_TONE: Record<string, string> = {
  danger: "text-danger",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-muted",
  neutre: "text-muted",
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
  const { submissionsByLabel } = useDerived();

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
      .map((label) => {
        const last = (submissionsByLabel.get(label.id) ?? [])
          .filter((s) => !s.archived)
          .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at))[0];
        return {
          label,
          last,
          trackTitle: last ? (tracks.find((t) => t.id === last.track_id)?.title ?? null) : null,
        };
      })
      /*
       * Ce qui réclame une action passe devant, du plus en retard au moins
       * pressé ; le reste suit par ordre alphabétique. Plus besoin d'un encart
       * de rappels au-dessus du tableau : le tableau est le rappel.
       */
      .sort((a, b) => {
        const rank = (row: Row) => {
          if (!row.last) return 3;
          const t = submissionTiming(row.last);
          if (t.needsFollowup) return 0;
          if (row.last.responded) return 2;
          return 1;
        };
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) {
          const la = submissionTiming(a.last!).followupOverdueDays ?? 0;
          const lb = submissionTiming(b.last!).followupOverdueDays ?? 0;
          if (la !== lb) return lb - la;
        }
        return a.label.name.localeCompare(b.label.name, "fr");
      });
  }, [labels, query, styleFilter, submissionsByLabel, tracks]);

  const toFollowUp = rows.filter(
    (r) => r.last && !r.last.responded && submissionTiming(r.last).needsFollowup,
  ).length;

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
    <div className="mx-auto w-full max-w-[1560px] px-5 pb-16 pt-4 lg:px-10 lg:pt-9">
      <PageHeader
        title="Labels"
        eyebrow={
          <>
            {plural(rows.length, "label")}
            {toFollowUp > 0 ? ` · ${plural(toFollowUp, "relance")} à faire` : ""}
          </>
        }
        action={
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <IconPlus size={17} />
            Ajouter un label
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
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
        }
      />

      {rows.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 py-3 text-base text-muted">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="eyebrow px-5 py-3 font-medium">Label</th>
                  <th className="eyebrow px-4 py-3 font-medium">Dernière track</th>
                  <th className="eyebrow px-4 py-3 font-medium">Envoi</th>
                  <th className="eyebrow px-4 py-3 font-medium">Suivi</th>
                  <th className="eyebrow px-4 py-3 font-medium">Répondu</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ label, last, trackTitle }) => {
                  const timing = last ? submissionTiming(last) : null;
                  return (
                    <tr
                      key={label.id}
                      className="border-b border-line/60 last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => openLabel(label.id)}
                          className="block text-left"
                        >
                          <span className="block text-base font-medium text-ink hover:text-accent-ink">
                            {label.name}
                          </span>
                          <span className="block truncate text-sm text-muted">
                            {[label.contact_name, label.genres.slice(0, 2).join(", ")]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-ink-soft">{trackTitle ?? "—"}</td>
                      <td className="readout px-4 py-3.5 text-muted">
                        {last?.sent_at ? formatDate(last.sent_at, "d MMM yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {timing ? (
                          <span className={cn("flex items-center gap-2", TIMING_TONE[timing.tone])}>
                            <span
                              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[timing.tone])}
                              aria-hidden
                            />
                            {timing.label}
                          </span>
                        ) : (
                          <span className="text-muted">Jamais contacté</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {last ? (
                          <Checkbox
                            checked={last.responded}
                            onChange={(checked) => setResponded(last, checked)}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
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
          <ul className="space-y-3 lg:hidden">
            {rows.map(({ label, last, trackTitle }) => {
              const timing = last ? submissionTiming(last) : null;
              return (
                <li key={label.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openLabel(label.id)}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-base font-medium text-ink">
                        {label.name}
                      </span>
                      <span className="block truncate text-sm text-muted">
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
                    <div className="mt-3 space-y-2.5 border-t border-line/60 pt-3">
                      <p className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            timing ? DOT_TONE[timing.tone] : "bg-line-strong",
                          )}
                          aria-hidden
                        />
                        <span className={timing ? TIMING_TONE[timing.tone] : "text-muted"}>
                          {timing?.label}
                        </span>
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-ink-soft">{trackTitle ?? "—"}</span>
                        <Checkbox
                          checked={last.responded}
                          onChange={(checked) => setResponded(last, checked)}
                          label={<span className="text-sm text-muted">Répondu</span>}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Jamais contacté</p>
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
