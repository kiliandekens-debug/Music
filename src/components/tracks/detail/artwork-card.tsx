"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaUrl, removeMedia, uploadMedia } from "@/lib/storage";
import { useData } from "@/lib/store/data";
import { Button, Field, Input } from "@/components/ui";
import { IconUpload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { Track } from "@/lib/types";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/**
 * Artwork provisoire d'une track : soit un fichier envoyé dans le stockage
 * privé, soit une simple adresse d'image si la pochette vit ailleurs.
 */
export function ArtworkCard({ track }: { track: Track }) {
  const { userId, update } = useData();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState(track.artwork_url ?? "");
  const [busy, setBusy] = useState(false);

  // Le bucket est privé : on demande une URL signée pour afficher l'aperçu.
  useEffect(() => {
    let cancelled = false;
    if (track.artwork_path) {
      getMediaUrl(track.artwork_path)
        .then((signed) => {
          if (!cancelled) setPreview(signed);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    } else {
      setPreview(track.artwork_url ?? null);
    }
    return () => {
      cancelled = true;
    };
  }, [track.artwork_path, track.artwork_url]);

  useEffect(() => {
    setUrl(track.artwork_url ?? "");
  }, [track.artwork_url]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const previousPath = track.artwork_path;
      const { path } = await uploadMedia(userId, `tracks/${track.id}/artwork`, file);
      await update("tracks", track.id, { artwork_path: path, artwork_url: null });
      if (previousPath) {
        try {
          await removeMedia(previousPath);
        } catch {
          // L'ancien fichier a peut-être déjà disparu.
        }
      }
      toast.success("Artwork mis à jour");
    } catch (e) {
      toast.error(e instanceof Error ? `Envoi impossible : ${e.message}` : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      if (track.artwork_path) {
        try {
          await removeMedia(track.artwork_path);
        } catch {
          // ignoré
        }
      }
      await update("tracks", track.id, { artwork_path: null, artwork_url: null });
      setPreview(null);
      setUrl("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
          {preview ? (
            // Image distante ou signée : `img` natif, pas d'optimisation Next.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`Artwork de ${track.title}`}
              className="h-full w-full object-cover"
              onError={() => setPreview(null)}
            />
          ) : (
            <span className="px-2 text-center text-label text-muted">Aucune image</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={() => fileInput.current?.click()}>
              <IconUpload size={15} />
              Envoyer une image
            </Button>
            {preview ? (
              <Button size="sm" variant="ghost" onClick={() => void clear()}>
                Retirer
              </Button>
            ) : null}
          </div>

          <Field label="ou adresse d'une image" hint="Utile si la pochette est déjà en ligne.">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
              <Button
                size="sm"
                variant="subtle"
                onClick={() =>
                  void update("tracks", track.id, {
                    artwork_url: url.trim() || null,
                    artwork_path: null,
                  })
                }
              >
                Appliquer
              </Button>
            </div>
          </Field>
      </div>
    </div>
  );
}
