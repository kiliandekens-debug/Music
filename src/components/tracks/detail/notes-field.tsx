"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/store/data";

/**
 * Zone de notes qui s'enregistre seule après une courte pause de frappe.
 * Pas de bouton « Enregistrer » : on écrit, ça reste.
 *
 * Les mêmes notes apparaissent dans deux blocs de la fiche. Un champ ne reprend
 * donc la valeur venue du store que s'il n'est pas en train d'être modifié,
 * sinon une sauvegarde faite ailleurs écraserait la frappe en cours.
 */
export function NotesField({
  trackId,
  value: stored,
  placeholder,
  rows = 4,
}: {
  trackId: string;
  value: string | null;
  placeholder?: string;
  rows?: number;
}) {
  const { update } = useData();
  const [value, setValue] = useState(stored ?? "");
  const [saved, setSaved] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  // Changement de track : on repart des notes de la nouvelle track.
  useEffect(() => {
    dirty.current = false;
    setSaved(true);
  }, [trackId]);

  useEffect(() => {
    if (dirty.current || (area.current && document.activeElement === area.current)) return;
    setValue(stored ?? "");
  }, [stored, trackId]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function onChange(next: string) {
    setValue(next);
    setSaved(false);
    dirty.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void update("tracks", trackId, { notes: next.trim() || null }).then(() => {
        dirty.current = false;
        setSaved(true);
      });
    }, 800);
  }

  return (
    <div>
      <textarea
        ref={area}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {!saved ? <p className="mt-1 text-[11px] text-faint">Enregistrement…</p> : null}
    </div>
  );
}
