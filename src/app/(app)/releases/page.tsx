"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CAMPAIGN_STATUS_LABEL, CONTACT_CATEGORY_LABEL } from "@/lib/constants";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { campaignProgress } from "@/lib/domain/progress";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  ProgressBar,
  SearchInput,
  Select,
  Tabs,
  cn,
} from "@/components/ui";
import { IconMore, IconPlus, IconRelease, IconTarget } from "@/components/ui/icons";
import { ContentList, MetricsPanel, OutreachList } from "@/components/promo/panels";
import { ContactForm } from "@/components/promo/forms";
import type { PromotionContact } from "@/lib/types";

export default function ReleasesPage() {
  return (
    <Suspense fallback={null}>
      <ReleasesContent />
    </Suspense>
  );
}

function ReleasesContent() {
  const params = useSearchParams();
  const { campaigns, promoTasks, tracks, labels } = useData();
  const { inWorkspace } = useUi();

  const [tab, setTab] = useState(params.get("onglet") ?? "campagnes");

  const visibleCampaigns = useMemo(() => {
    return campaigns
      .map((campaign) => {
        const track = tracks.find((t) => t.id === campaign.track_id);
        return { campaign, track };
      })
      .filter(({ track }) => track && !track.archived && inWorkspace(track))
      .sort((a, b) =>
        (a.campaign.release_date ?? "9999").localeCompare(b.campaign.release_date ?? "9999"),
      );
  }, [campaigns, tracks, inWorkspace]);

  return (
    <div className="px-4 py-5 lg:px-6">
      <Tabs
        active={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { id: "campagnes", label: "Campagnes", count: visibleCampaigns.length },
          { id: "contenus", label: "Contenus" },
          { id: "contacts", label: "Contacts promo" },
          { id: "envois", label: "Envois promo" },
          { id: "resultats", label: "Résultats" },
        ]}
      />

      {tab === "campagnes" ? (
        visibleCampaigns.length === 0 ? (
          <EmptyState
            icon={<IconRelease size={28} />}
            title="Aucune campagne"
            description="Une campagne se crée depuis la fiche d'une track, dans l'onglet Promotion, dès qu'une date de sortie est connue."
            action={
              <Link href="/studio">
                <Button variant="primary">Aller au studio</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleCampaigns.map(({ campaign, track }) => {
              if (!track) return null;
              const tasks = promoTasks.filter((t) => t.campaign_id === campaign.id);
              const progress = campaignProgress(tasks);
              const until = campaign.release_date ? daysUntil(campaign.release_date) : null;
              const nextTasks = tasks
                .filter((t) => t.status !== "terminee" && t.status !== "ignoree" && t.due_date)
                .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
                .slice(0, 3);

              return (
                <Card key={campaign.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/studio/${track.id}?onglet=promotion`}
                        className="truncate text-[14px] font-medium text-ink hover:text-accent-ink"
                      >
                        {track.title}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {campaign.release_date
                          ? `Sortie le ${formatDate(campaign.release_date)}`
                          : "Date de sortie à définir"}
                        {campaign.label_id
                          ? ` · ${labels.find((l) => l.id === campaign.label_id)?.name ?? ""}`
                          : ""}
                      </p>
                    </div>
                    {until !== null ? (
                      <Badge
                        tone={until < 0 ? "neutre" : until <= 7 ? "warn" : "info"}
                      >
                        {until === 0 ? "Jour J" : until > 0 ? `J−${until}` : `J+${Math.abs(until)}`}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={campaign.status === "terminee" ? "ok" : "accent"}>
                      {CAMPAIGN_STATUS_LABEL[campaign.status]}
                    </Badge>
                    {campaign.budget ? <Badge>{formatMoney(campaign.budget)}</Badge> : null}
                  </div>

                  <ProgressBar
                    className="mt-3"
                    value={progress.percent}
                    label={`${progress.done}/${progress.total} tâches`}
                    tone="info"
                  />

                  {nextTasks.length > 0 ? (
                    <ul className="mt-3 space-y-1 border-t border-line pt-2.5">
                      {nextTasks.map((task) => {
                        const late = (daysUntil(task.due_date) ?? 0) < 0;
                        return (
                          <li key={task.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12px] text-ink-soft">{task.title}</span>
                            <span
                              className={cn(
                                "shrink-0 text-[11px]",
                                late ? "text-danger" : "text-faint",
                              )}
                            >
                              {formatDate(task.due_date, "d MMM")}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "contenus" ? <ContentList /> : null}
      {tab === "contacts" ? <ContactsTab /> : null}
      {tab === "envois" ? <OutreachList /> : null}
      {tab === "resultats" ? <MetricsPanel /> : null}
    </div>
  );
}

function ContactsTab() {
  const { contacts, outreach, update } = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("tous");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PromotionContact | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        if (contact.archived) return false;
        if (category !== "tous" && contact.category !== category) return false;
        if (q && !`${contact.name} ${contact.email ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [contacts, search, category]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nom ou e-mail…"
          className="w-full sm:w-56"
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto"
          aria-label="Catégorie"
        >
          <option value="tous">Toutes les catégories</option>
          {Object.entries(CONTACT_CATEGORY_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Nouveau contact
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconTarget size={28} />}
          title="Aucun contact promo"
          description="DJs, radios, playlists, médias : gardez ici les personnes à qui vous envoyez vos sorties."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Ajouter un contact
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact) => {
            const sent = outreach.filter((o) => o.contact_id === contact.id);
            const supports = sent.filter((o) => o.support_type !== "aucun" && o.responded_at);
            return (
              <Card key={contact.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{contact.name}</p>
                    <p className="truncate text-[12px] text-muted">
                      {[CONTACT_CATEGORY_LABEL[contact.category], contact.country, contact.platform]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Menu
                    trigger={(props) => (
                      <IconButton label="Actions" {...props}>
                        <IconMore size={16} />
                      </IconButton>
                    )}
                  >
                    <MenuItem onClick={() => setEditing(contact)}>Modifier</MenuItem>
                    <MenuItem
                      onClick={() =>
                        void update("promotion_contacts", contact.id, { archived: true })
                      }
                    >
                      Archiver
                    </MenuItem>
                  </Menu>
                </div>

                <div className="mt-2.5 flex items-center gap-3 border-t border-line pt-2.5 text-[12px] text-muted">
                  <span>
                    <span className="tabular font-medium text-ink">{sent.length}</span> envois
                  </span>
                  <span>
                    <span className="tabular font-medium text-ok">{supports.length}</span> soutiens
                  </span>
                </div>

                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-2 block truncate text-[12px] text-accent hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau contact promo">
        <ContactForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le contact">
        {editing ? (
          <ContactForm
            contact={editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
