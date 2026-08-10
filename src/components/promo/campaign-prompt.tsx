"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { generatePromoPlan } from "@/lib/domain/promo-plan";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Button, Card, cn } from "@/components/ui";
import { IconTarget } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useLocalState } from "@/lib/hooks";
import type { Track } from "@/lib/types";

/**
 * Proposition de créer la campagne promotionnelle.
 *
 * Apparaît dès qu'une track a une date de sortie ou atteint une étape de type
 * « signée / planifiée » sans campagne associée. La création reste un choix :
 * rien n'est généré dans le dos du producteur, et la proposition peut être
 * écartée track par track.
 */
export function CampaignPrompt({ track }: { track: Track }) {
  const router = useRouter();
  const { campaigns, insert, insertMany, log } = useData();
  const { stageById } = useDerived();
  const toast = useToast();
  const [dismissed, setDismissed] = useLocalState<string[]>("atelier.campagne.ecartees", []);
  const [busy, setBusy] = useState(false);

  const campaign = campaigns.find((c) => c.track_id === track.id);
  if (campaign) return null;
  if (dismissed.includes(track.id)) return null;

  const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
  const stageSuggests = Boolean(stage && (stage.is_released || stage.key === "signee"));
  if (!track.release_date && !stageSuggests) return null;

  async function createCampaign() {
    setBusy(true);
    try {
      const created = await insert("promotion_campaigns", {
        track_id: track.id,
        release_date: track.release_date,
        label_id: track.intended_label_id,
        distributor: track.distributor,
        status: "a_preparer",
      });

      const plan = generatePromoPlan(track.release_date);
      await insertMany(
        "promotion_tasks",
        plan.map((item) => ({
          campaign_id: created.id,
          track_id: track.id,
          title: item.title,
          group_key: item.group_key,
          offset_days: item.offset_days,
          due_date: item.due_date,
          is_asset: item.is_asset,
          position: item.position,
          weight: item.weight,
        })),
      );

      log({
        entity_type: "promotion_campaign",
        entity_id: created.id,
        track_id: track.id,
        action: "campagne_creee",
        summary: "Campagne créée avec le planning complet",
      });
      toast.success("Campagne et planning créés");
      router.push(`/studio/${track.id}?onglet=promotion`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("border-accent/30 bg-accent-soft/30 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <IconTarget size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">
              Créer la campagne promotionnelle ?
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {track.release_date
                ? `Sortie prévue le ${formatDate(track.release_date)}. Le planning sera calculé à rebours, de J−28 à J+14.`
                : `« ${stage?.name ?? "Cette étape"} » : préparez la sortie dès maintenant, le planning suivra la date une fois connue.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed((prev) => [...prev, track.id])}
          >
            Plus tard
          </Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void createCampaign()}>
            Créer la campagne
          </Button>
        </div>
      </div>
    </Card>
  );
}
