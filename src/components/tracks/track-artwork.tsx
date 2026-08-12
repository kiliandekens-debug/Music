"use client";

import { useEffect, useState } from "react";
import { getMediaUrl } from "@/lib/storage";
import { cn } from "@/components/ui";
import { IconMusic } from "@/components/ui/icons";
import type { Track } from "@/lib/types";

/**
 * Pochette d'une track. Le stockage est privé : un fichier envoyé demande une
 * URL signée, une adresse externe s'affiche telle quelle. Sans image, on montre
 * un aplat discret plutôt qu'un trou dans la mise en page.
 */
export function TrackArtwork({ track, className }: { track: Track; className?: string }) {
  const [url, setUrl] = useState<string | null>(track.artwork_url);

  useEffect(() => {
    let cancelled = false;
    if (track.artwork_path) {
      getMediaUrl(track.artwork_path)
        .then((signed) => {
          if (!cancelled) setUrl(signed);
        })
        .catch(() => {
          if (!cancelled) setUrl(null);
        });
    } else {
      setUrl(track.artwork_url);
    }
    return () => {
      cancelled = true;
    };
  }, [track.artwork_path, track.artwork_url]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-faint",
        className,
      )}
    >
      {url ? (
        // Image distante ou signée : `img` natif, pas d'optimisation Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setUrl(null)}
        />
      ) : (
        <IconMusic size={20} />
      )}
    </div>
  );
}
