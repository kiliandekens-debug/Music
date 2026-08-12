"use client";

import { Button } from "@/components/ui";
import { ReleaseChecklist } from "@/components/promo/release-checklist";
import type { Track } from "@/lib/types";

/**
 * Préparation de la sortie.
 * Sans date de sortie, il n'y a rien à préparer : le bloc se réduit à une
 * phrase et au bouton qui débloque la suite.
 */
export function PromotionBlock({ track, onEdit }: { track: Track; onEdit: () => void }) {
  if (!track.release_date) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-1 text-sm text-muted">
        <span>Aucune date de sortie enregistrée.</span>
        <Button size="sm" variant="outline" onClick={onEdit}>
          Ajouter une date de sortie
        </Button>
      </div>
    );
  }

  return <ReleaseChecklist track={track} />;
}
