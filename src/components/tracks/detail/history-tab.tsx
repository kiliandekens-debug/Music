"use client";

import { useMemo } from "react";
import { formatDateTime } from "@/lib/format";
import { useProgressiveList } from "@/lib/hooks";
import { Button, Card, EmptyState } from "@/components/ui";
import { IconNote } from "@/components/ui/icons";
import type { ActivityEntry, Track } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  track_creee: "Création",
  track_modifiee: "Modification",
  changement_etape: "Étape",
  blocage: "Blocage",
  deblocage: "Déblocage",
  modele_applique: "Checklist",
  version_ajoutee: "Version audio",
  envoi_cree: "Envoi label",
  reponse_recue: "Réponse label",
  signature: "Signature",
  campagne_creee: "Campagne",
  date_sortie_modifiee: "Date de sortie",
  session_terminee: "Session",
};

/** Journal des évènements importants de la track. */
export function HistoryTab({ track, entries }: { track: Track; entries: ActivityEntry[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [entries],
  );
  const [visible, hasMore, showMore] = useProgressiveList(sorted, 30);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<IconNote size={26} />}
        title="Aucun évènement"
        description="Les changements d'étape, envois, réponses et sessions apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {visible.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink-soft">{entry.summary}</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {ACTION_LABEL[entry.action] ?? entry.action} · {formatDateTime(entry.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={showMore}>
            Afficher plus
          </Button>
        </div>
      ) : null}

      {track.notes ? (
        <Card className="p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Notes générales
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
            {track.notes}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
