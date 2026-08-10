"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalState } from "@/lib/hooks";
import { accentHex } from "@/lib/constants";
import { useData } from "./data";
import type { Track } from "@/lib/types";

export type QuickAddKind =
  | "track"
  | "idee"
  | "tache"
  | "session"
  | "label"
  | "envoi"
  | "contact"
  | "contenu"
  | "resultat";

interface UiContextValue {
  /** Espace sélectionné, ou "tous". Filtre l'ensemble des données. */
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  /** Filtre une liste de tracks selon l'espace sélectionné. */
  filterTracks: <T extends { workspace_id: string | null }>(items: T[]) => T[];
  /** Vrai si la track appartient à l'espace sélectionné. */
  inWorkspace: (track: Pick<Track, "workspace_id">) => boolean;
  quickAdd: QuickAddKind | null;
  openQuickAdd: (kind?: QuickAddKind) => void;
  closeQuickAdd: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { profile, workspaces } = useData();
  const [workspaceId, setWorkspaceId] = useLocalState<string>("atelier.workspace", "tous");
  const [quickAdd, setQuickAdd] = useState<QuickAddKind | null>(null);

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
      quickAdd,
      openQuickAdd: (kind = "track") => setQuickAdd(kind),
      closeQuickAdd: () => setQuickAdd(null),
    }),
    [workspaceId, setWorkspaceId, filterTracks, inWorkspace, quickAdd],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi doit être utilisé à l'intérieur de UiProvider");
  return context;
}
