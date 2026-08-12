"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useLocalState } from "@/lib/hooks";
import { accentHex } from "@/lib/constants";
import { useData } from "./data";
import type { Track } from "@/lib/types";

interface UiContextValue {
  /**
   * Alias sélectionné, ou "tous". C'est le seul filtre global : il est piloté
   * depuis l'en-tête du Studio et s'applique partout pour rester cohérent.
   */
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  /** Filtre une liste de tracks selon l'alias sélectionné. */
  filterTracks: <T extends { workspace_id: string | null }>(items: T[]) => T[];
  /** Vrai si la track appartient à l'alias sélectionné. */
  inWorkspace: (track: Pick<Track, "workspace_id">) => boolean;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { profile, workspaces } = useData();
  const [workspaceId, setWorkspaceId] = useLocalState<string>("atelier.workspace", "tous");

  // Couleur d'accentuation globale, pilotée par le profil.
  useEffect(() => {
    const hex = accentHex(profile?.accent);
    document.documentElement.style.setProperty("--accent", hex);
  }, [profile?.accent]);

  // Si l'espace mémorisé a été archivé ou supprimé, on revient à « tous ».
  useEffect(() => {
    if (workspaceId === "tous") return;
    const found = workspaces.find((w) => w.id === workspaceId);
    if (workspaces.length > 0 && (!found || found.archived)) setWorkspaceId("tous");
  }, [workspaceId, workspaces, setWorkspaceId]);

  const filterTracks = useCallback(
    <T extends { workspace_id: string | null }>(items: T[]): T[] =>
      workspaceId === "tous" ? items : items.filter((item) => item.workspace_id === workspaceId),
    [workspaceId],
  );

  const inWorkspace = useCallback(
    (track: Pick<Track, "workspace_id">) =>
      workspaceId === "tous" || track.workspace_id === workspaceId,
    [workspaceId],
  );

  const value = useMemo<UiContextValue>(
    () => ({
      workspaceId,
      setWorkspaceId,
      filterTracks,
      inWorkspace,
    }),
    [workspaceId, setWorkspaceId, filterTracks, inWorkspace],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi doit être utilisé à l'intérieur de UiProvider");
  return context;
}
