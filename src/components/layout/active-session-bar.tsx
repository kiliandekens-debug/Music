"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store/data";
import { useSession } from "@/lib/store/session";
import { useElapsedSeconds } from "@/lib/hooks";
import { formatClock } from "@/lib/format";
import { Button } from "@/components/ui";
import { IconPause, IconPlay } from "@/components/ui/icons";

/** Barre persistante rappelant qu'une session est en cours, hors Mode Session. */
export function ActiveSessionBar() {
  const pathname = usePathname();
  const { tracks } = useData();
  const { active, paused, baseSeconds, togglePause } = useSession();
  const live = useElapsedSeconds(active?.started_at ?? null, Boolean(active) && !paused);

  if (!active || pathname === "/sessions/mode") return null;

  const track = tracks.find((t) => t.id === active.track_id);
  const elapsed = paused ? baseSeconds : live;

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-40 px-3 lg:bottom-4 lg:left-auto lg:right-4 lg:px-0">
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-surface-2/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur lg:w-80">
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? "Reprendre" : "Mettre en pause"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
        >
          {paused ? <IconPlay size={16} /> : <IconPause size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">
            {track?.title ?? "Session en cours"}
          </p>
          <p className="tabular text-[12px] text-muted">
            {formatClock(elapsed)}
            {paused ? " · en pause" : ""}
          </p>
        </div>
        <Link href="/sessions/mode">
          <Button size="sm" variant="outline">
            Ouvrir
          </Button>
        </Link>
      </div>
    </div>
  );
}
