"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/data";
import { Modal, SearchInput, cn } from "@/components/ui";
import { IconLabel, IconMusic, IconTarget } from "@/components/ui/icons";

interface Hit {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: (props: { size?: number }) => React.ReactElement;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Recherche transversale : tracks, labels et contacts promo. */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { tracks, labels, contacts, workspaces } = useData();
  const [query, setQuery] = useState("");

  const hits = useMemo<Hit[]>(() => {
    const q = normalize(query.trim());
    if (q.length < 1) return [];
    const workspaceById = new Map(workspaces.map((w) => [w.id, w]));
    const out: Hit[] = [];

    for (const track of tracks) {
      if (out.length > 40) break;
      const haystack = normalize(
        `${track.title} ${track.genre ?? ""} ${track.subgenre ?? ""} ${track.musical_key ?? ""}`,
      );
      if (!haystack.includes(q)) continue;
      out.push({
        id: `track-${track.id}`,
        label: track.title,
        detail: [
          workspaceById.get(track.workspace_id ?? "")?.name,
          track.genre,
          track.bpm ? `${track.bpm} BPM` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/studio/${track.id}`,
        icon: IconMusic,
      });
    }

    for (const label of labels) {
      if (out.length > 60) break;
      const haystack = normalize(`${label.name} ${label.contact_name ?? ""} ${label.email ?? ""}`);
      if (!haystack.includes(q)) continue;
      out.push({
        id: `label-${label.id}`,
        label: label.name,
        detail: [label.contact_name, label.country].filter(Boolean).join(" · ") || "Label",
        href: `/labels?label=${label.id}`,
        icon: IconLabel,
      });
    }

    for (const contact of contacts) {
      if (out.length > 80) break;
      const haystack = normalize(`${contact.name} ${contact.email ?? ""}`);
      if (!haystack.includes(q)) continue;
      out.push({
        id: `contact-${contact.id}`,
        label: contact.name,
        detail: "Contact promo",
        href: `/releases?onglet=contacts&contact=${contact.id}`,
        icon: IconTarget,
      });
    }

    return out;
  }, [query, tracks, labels, contacts, workspaces]);

  function go(href: string) {
    router.push(href);
    setQuery("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Rechercher" size="md">
      <div className="space-y-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Track, label, contact…"
        />
        {query.trim() === "" ? (
          <p className="py-6 text-center text-[13px] text-faint">
            Tapez pour chercher parmi vos tracks, labels et contacts.
          </p>
        ) : hits.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">Aucun résultat.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {hits.map((hit) => {
              const Icon = hit.icon;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => go(hit.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100",
                      "hover:bg-surface-2",
                    )}
                  >
                    <span className="text-faint">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{hit.label}</span>
                      {hit.detail ? (
                        <span className="block truncate text-[11px] text-faint">{hit.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
