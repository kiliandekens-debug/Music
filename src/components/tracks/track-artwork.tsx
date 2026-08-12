"use client";

import { useEffect, useState } from "react";
import { getMediaUrl } from "@/lib/storage";
import { cn } from "@/components/ui";
import { IconMusic } from "@/components/ui/icons";
import type { Track } from "@/lib/types";

/**
 * Pochette d'une track.
 *
 * Le stockage est privé : un fichier envoyé demande une URL signée, une adresse
 * externe s'affiche telle quelle. Sans pochette, on ne laisse pas un carré gris :
 * l'emplacement prend un dégradé tiré de la couleur de l'alias, de sorte que la
 * mise en page reste vivante et que chaque projet garde son identité.
 */
export function TrackArtwork({
  track,
  color,
  className,
  iconSize = 20,
}: {
  track: Track;
  color?: string;
  className?: string;
  iconSize?: number;
}) {
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

  const tint = color ?? "var(--accent)";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
      style={
        url
          ? undefined
          : {
              backgroundImage: `linear-gradient(140deg, color-mix(in oklab, ${tint} 42%, transparent), color-mix(in oklab, ${tint} 8%, transparent))`,
            }
      }
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
        <span style={{ color: tint }} className="opacity-80">
          <IconMusic size={iconSize} />
        </span>
      )}
    </div>
  );
}
