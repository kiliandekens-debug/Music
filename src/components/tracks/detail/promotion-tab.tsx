"use client";

import { CampaignPanel } from "@/components/promo/campaign-panel";
import { ContentList, MetricsPanel, OutreachList } from "@/components/promo/panels";
import type { Track } from "@/lib/types";

export function PromotionTab({ track }: { track: Track }) {
  return (
    <div className="space-y-4">
      <CampaignPanel track={track} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ContentList trackId={track.id} />
        <OutreachList trackId={track.id} />
      </div>
      <MetricsPanel trackId={track.id} />
    </div>
  );
}
