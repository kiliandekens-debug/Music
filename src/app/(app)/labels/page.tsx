"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ALIAS_SCOPE_LABEL,
  SUBMISSION_METHOD_LABEL,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { computeSubmissionStats, submissionTiming } from "@/lib/domain/submissions";
import { useDebounced, useLocalState, useProgressiveList } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  SearchInput,
  SegmentedControl,
  Select,
  Tabs,
  cn,
} from "@/components/ui";
import { IconGrid, IconLabel, IconList, IconMore, IconPlus } from "@/components/ui/icons";
import { LabelForm } from "@/components/labels/label-form";
import { SubmissionForm } from "@/components/labels/submission-form";
import { SubmissionList } from "@/components/labels/submission-list";
import { LabelPanel } from "@/components/labels/label-panel";
import type { Label } from "@/lib/types";

type ContactFilter =
  | "tous"
  | "contactes"
  | "jamais"
  | "sans_reponse"
  | "positives"
  | "a_relancer";

export default function LabelsPage() {
  return (
    <Suspense fallback={null}>
      <LabelsContent />
    </Suspense>
  );
}

function LabelsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { labels, submissions, tracks, update } = useData();
  const { submissionsByLabel } = useDerived();

  const [tab, setTab] = useState<"labels" | "envois">(
    params.get("envoi") ? "envois" : "labels",
  );
  const [view, setView] = useLocalState<"table" | "cartes">("atelier.labels.vue", "table");
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 180);
  const [genreFilter, setGenreFilter] = useLocalState("atelier.labels.genre", "tous");
  const [aliasFilter, setAliasFilter] = useLocalState("atelier.labels.alias", "tous");
  const [countryFilter, setCountryFilter] = useLocalState("atelier.labels.pays", "tous");
  const [contactFilter, setContactFilter] = useLocalState<ContactFilter>(
    "atelier.labels.contact",
    "tous",
  );
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [addingSubmission, setAddingSubmission] = useState(false);
  const [statusFilter, setStatusFilter] = useState("tous");

  const openLabelId = params.get("label");
  const focusSubmissionId = params.get("envoi");

  const genres = useMemo(
    () => [...new Set(labels.flatMap((l) => l.genres))].sort((a, b) => a.localeCompare(b, "fr")),
    [labels],
  );
  const countries = useMemo(
    () =>
      [...new Set(labels.map((l) => l.country).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "fr"),
      ) as string[],
    [labels],
  );

  const filteredLabels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labels
      .filter((label) => {
        if (label.archived !== showArchived) return false;
        if (q) {
          const haystack =
            `${label.name} ${label.contact_name ?? ""} ${label.email ?? ""} ${label.country ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (genreFilter !== "tous" && !label.genres.includes(genreFilter)) return false;
        if (aliasFilter !== "tous") {
          if (aliasFilter === "deepest_mind" || aliasFilter === "elvik") {
            if (label.alias_scope !== aliasFilter && label.alias_scope !== "les_deux") return false;
          } else if (label.alias_scope !== aliasFilter) return false;
        }
        if (countryFilter !== "tous" && label.country !== countryFilter) return false;

        if (contactFilter !== "tous") {
          const own = submissionsByLabel.get(label.id) ?? [];
          const stats = computeSubmissionStats(own);
          switch (contactFilter) {
            case "contactes":
              if (stats.sent === 0) return false;
              break;
            case "jamais":
              if (stats.sent > 0) return false;
              break;
            case "sans_reponse":
              if (stats.sent === 0 || stats.responded > 0) return false;
              break;
            case "positives":
              if (stats.positive === 0) return false;
              break;
            case "a_relancer":
              if (stats.overdueFollowups === 0) return false;
              break;
          }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [
    labels,
    query,
    showArchived,
    genreFilter,
    aliasFilter,
    countryFilter,
    contactFilter,
    submissionsByLabel,
  ]);

  const [visibleLabels, hasMoreLabels, showMoreLabels] = useProgressiveList(filteredLabels, 40);

  const filteredSubmissions = useMemo(() => {
    const list = submissions.filter((submission) => {
      if (statusFilter !== "tous" && submission.status !== statusFilter) return false;
      if (query.trim()) {
        const label = labels.find((l) => l.id === submission.label_id);
        const track = tracks.find((t) => t.id === submission.track_id);
        const haystack = `${label?.name ?? ""} ${track?.title ?? ""}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      if (focusSubmissionId) {
        if (a.id === focusSubmissionId) return -1;
        if (b.id === focusSubmissionId) return 1;
      }
      const at = submissionTiming(a);
      const bt = submissionTiming(b);
      if (at.needsFollowup !== bt.needsFollowup) return at.needsFollowup ? -1 : 1;
      return (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at);
    });
  }, [submissions, statusFilter, query, labels, tracks, focusSubmissionId]);

  const [visibleSubmissions, hasMoreSubmissions, showMoreSubmissions] = useProgressiveList(
    filteredSubmissions,
    30,
  );

  function openLabel(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("label", id);
    else next.delete("label");
    router.replace(`/labels${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }

  return (
    <div className="px-4 py-5 lg:px-6">
      <Tabs
        active={tab}
        onChange={(id) => setTab(id as "labels" | "envois")}
        className="mb-4"
        tabs={[
          { id: "labels", label: "Labels", count: labels.filter((l) => !l.archived).length },
          { id: "envois", label: "Suivi des envois", count: submissions.length },
        ]}
      />

      {tab === "labels" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: "table", label: <IconList size={15} />, title: "Tableau" },
                { value: "cartes", label: <IconGrid size={15} />, title: "Cartes" },
              ]}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Nom, contact, e-mail…"
              className="w-full sm:w-56"
            />
            <Select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="w-auto"
              aria-label="Genre"
            >
              <option value="tous">Tous les styles</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </Select>
            <Select
              value={aliasFilter}
              onChange={(e) => setAliasFilter(e.target.value)}
              className="w-auto"
              aria-label="Alias"
            >
              <option value="tous">Tous les alias</option>
              <option value="deepest_mind">Deepest Mind</option>
              <option value="elvik">ELVIK</option>
              <option value="autre">Autre</option>
            </Select>
            <Select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-auto"
              aria-label="Pays"
            >
              <option value="tous">Tous les pays</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
            <Select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
              className="w-auto"
              aria-label="Statut de contact"
            >
              <option value="tous">Tous</option>
              <option value="contactes">Déjà contactés</option>
              <option value="jamais">Jamais contactés</option>
              <option value="sans_reponse">Aucune réponse</option>
              <option value="positives">Réponse positive</option>
              <option value="a_relancer">À relancer</option>
            </Select>
            <Checkbox checked={showArchived} onChange={setShowArchived} label="Archivés" />

            <div className="ml-auto">
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <IconPlus size={16} />
                Nouveau label
              </Button>
            </div>
          </div>

          {filteredLabels.length === 0 ? (
            <EmptyState
              icon={<IconLabel size={28} />}
              title="Aucun label"
              description="Constituez votre base de labels pour suivre chaque envoi et chaque réponse."
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Ajouter un label
                </Button>
              }
            />
          ) : view === "table" ? (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-2.5 font-medium">Label</th>
                    <th className="px-3 py-2.5 font-medium">Contact</th>
                    <th className="px-3 py-2.5 font-medium">Pays</th>
                    <th className="px-3 py-2.5 font-medium">Méthode</th>
                    <th className="px-3 py-2.5 font-medium">Envois</th>
                    <th className="px-3 py-2.5 font-medium">Réponses</th>
                    <th className="px-3 py-2.5 font-medium">Taux</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibleLabels.map((label) => {
                    const own = submissionsByLabel.get(label.id) ?? [];
                    const stats = computeSubmissionStats(own);
                    return (
                      <tr
                        key={label.id}
                        className="border-b border-line last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => openLabel(label.id)}
                            className="text-left font-medium text-ink hover:text-accent-ink"
                          >
                            {label.name}
                          </button>
                          {label.genres.length > 0 ? (
                            <p className="text-[11px] text-faint">{label.genres.join(", ")}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {label.contact_name ?? "—"}
                          {label.email ? (
                            <p className="text-[11px] text-faint">{label.email}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">{label.country ?? "—"}</td>
                        <td className="px-3 py-2.5 text-muted">
                          {SUBMISSION_METHOD_LABEL[label.preferred_method]}
                        </td>
                        <td className="tabular px-3 py-2.5 text-ink-soft">{stats.sent}</td>
                        <td className="px-3 py-2.5">
                          <span className="tabular text-ink-soft">{stats.responded}</span>
                          {stats.positive > 0 ? (
                            <span className="ml-1.5 text-[11px] text-ok">
                              +{stats.positive} positive{stats.positive > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="tabular px-3 py-2.5 text-muted">
                          {stats.sent === 0 ? "—" : `${Math.round(stats.responseRate)} %`}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Menu
                            trigger={(props) => (
                              <IconButton label="Actions" {...props}>
                                <IconMore size={16} />
                              </IconButton>
                            )}
                          >
                            <MenuItem onClick={() => openLabel(label.id)}>Voir la fiche</MenuItem>
                            <MenuItem onClick={() => setEditing(label)}>Modifier</MenuItem>
                            <MenuItem
                              onClick={() =>
                                void update("labels", label.id, { archived: !label.archived })
                              }
                            >
                              {label.archived ? "Désarchiver" : "Archiver"}
                            </MenuItem>
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleLabels.map((label) => {
                const own = submissionsByLabel.get(label.id) ?? [];
                const stats = computeSubmissionStats(own);
                return (
                  <Card
                    key={label.id}
                    interactive
                    onClick={() => openLabel(label.id)}
                    className="p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-ink">{label.name}</p>
                        <p className="truncate text-[12px] text-muted">
                          {[label.contact_name, label.country].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Badge>{ALIAS_SCOPE_LABEL[label.alias_scope]}</Badge>
                    </div>
                    {label.genres.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {label.genres.slice(0, 3).map((genre) => (
                          <Badge key={genre}>{genre}</Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 text-[12px] text-muted">
                      <span>
                        <span className="tabular font-medium text-ink">{stats.sent}</span> envois
                      </span>
                      <span>
                        <span className="tabular font-medium text-ink">{stats.responded}</span>{" "}
                        réponses
                      </span>
                      {stats.overdueFollowups > 0 ? (
                        <Badge tone="warn">{stats.overdueFollowups} à relancer</Badge>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {hasMoreLabels ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={showMoreLabels}>
                Afficher plus
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Track ou label…"
              className="w-full sm:w-56"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto"
              aria-label="Statut"
            >
              <option value="tous">Tous les statuts</option>
              {Object.entries(SUBMISSION_STATUS_LABEL).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
            <div className="ml-auto">
              <Button variant="primary" size="sm" onClick={() => setAddingSubmission(true)}>
                <IconPlus size={16} />
                Nouvel envoi
              </Button>
            </div>
          </div>

          {focusSubmissionId ? (
            <p className="mb-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[12px] text-accent-ink">
              Envoi mis en avant en haut de la liste.
            </p>
          ) : null}

          <SubmissionList
            submissions={visibleSubmissions}
            show="label"
            emptyMessage="Aucun envoi ne correspond à ces filtres."
          />

          {hasMoreSubmissions ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={showMoreSubmissions}>
                Afficher plus
              </Button>
            </div>
          ) : null}
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

      <Modal
        open={addingSubmission}
        onClose={() => setAddingSubmission(false)}
        title="Nouvel envoi"
        size="lg"
      >
        <SubmissionForm
          onDone={() => setAddingSubmission(false)}
          onCancel={() => setAddingSubmission(false)}
        />
      </Modal>

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
