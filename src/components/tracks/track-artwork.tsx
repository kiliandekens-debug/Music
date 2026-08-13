"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { getMediaUrl } from "@/lib/storage";
import { coverFor } from "@/lib/domain/cover";
import { cn } from "@/components/ui";
import type { Track } from "@/lib/types";

/**
 * Pochette d'une track.
 *
 * Le stockage est privé : un fichier envoyé demande une URL signée, une adresse
 * externe s'affiche telle quelle. Sans pochette, on ne laisse pas un carré gris :
 * une composition abstraite est dérivée de l'identifiant de la track et teintée
 * par la couleur de son alias. Chaque track a donc un visage, du vignette de
 * 40 px à l'affiche de la page Promotion.
 */
export function TrackArtwork({
  track,
  color,
  className,
  detailed = false,
}: {
  track: Track;
  color?: string;
  className?: string;
  /** Compose davantage de formes : réservé aux grands formats. */
  detailed?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(track.artwork_url);
  const gradientId = useId();
  const cover = useMemo(() => coverFor(track.id), [track.id]);

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

  if (url) {
    return (
      <div className={cn("shrink-0 overflow-hidden", className)}>
        {/* Image distante ou signée : `img` natif, pas d'optimisation Next. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setUrl(null)}
        />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden
      className={cn("shrink-0 overflow-hidden", className)}
    >
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${cover.angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={tint} stopOpacity="1" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.42" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#${gradientId})`} />
      <rect width="100" height="100" fill="#0b0a0f" opacity="0.16" />

      <circle
        cx={cover.disc.cx}
        cy={cover.disc.cy}
        r={cover.disc.r}
        fill="#ffffff"
        opacity={cover.disc.opacity * 1.6}
      />
      <circle
        cx={cover.ring.cx}
        cy={cover.ring.cy}
        r={cover.ring.r}
        fill="none"
        stroke="#ffffff"
        strokeWidth={detailed ? 1.2 : 2}
        opacity={cover.ring.opacity * 1.5}
      />
      {detailed ? (
        <>
          <circle
            cx={cover.ring.cx}
            cy={cover.ring.cy}
            r={cover.ring.r * 0.72}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity={cover.ring.opacity * 0.7}
          />
          <circle
            cx={cover.ring.cx}
            cy={cover.ring.cy}
            r={cover.ring.r * 0.46}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity={cover.ring.opacity * 0.5}
          />
        </>
      ) : null}

      <rect
        x="-30"
        y={cover.bandY}
        width="160"
        height={cover.bandHeight}
        fill="#ffffff"
        opacity="0.09"
        transform={`rotate(${cover.bandAngle} 50 ${cover.bandY})`}
      />

      {/* Rythme graphique en pied de composition : cinq traits, rien de mesuré. */}
      <g opacity="0.3">
        {cover.bars.map((height, index) => (
          <rect
            key={index}
            x={12 + index * 16}
            y={92 - height * 26}
            width="5"
            height={height * 26}
            rx="2.5"
            fill="#ffffff"
          />
        ))}
      </g>
    </svg>
  );
}
