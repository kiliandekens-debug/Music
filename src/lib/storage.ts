"use client";

import { getSupabase } from "@/lib/supabase/client";

export const MEDIA_BUCKET = "media";

/**
 * Chemin de stockage : le premier segment est l'identifiant utilisateur.
 * Les politiques du bucket s'appuient sur cette convention pour cloisonner
 * les fichiers entre comptes.
 */
export function mediaPath(userId: string, folder: string, fileName: string): string {
  const safeName = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${folder}/${Date.now()}-${safeName}`;
}

export async function uploadMedia(
  userId: string,
  folder: string,
  file: File,
): Promise<{ path: string }> {
  const path = mediaPath(userId, folder, file.name);
  const { error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return { path };
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** URL signée mise en cache : le bucket est privé, les liens sont temporaires. */
export async function getMediaUrl(path: string, expiresIn = 3600): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;

  const { data, error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("Lien indisponible");

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return data.signedUrl;
}

export async function removeMedia(path: string): Promise<void> {
  signedUrlCache.delete(path);
  const { error } = await getSupabase().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

/** Durée d'un fichier audio, lue localement avant l'envoi. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    });
    audio.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
    audio.src = url;
  });
}
