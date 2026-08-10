"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRIORITY_LABEL } from "@/lib/constants";
import { formatDate, formatDuration, relativeDayLabel } from "@/lib/format";
import { computeSubmissionStats } from "@/lib/domain/submissions";
import { useData } from "@/lib/store/data";
import { useDerived } from "@/lib/store/selectors";
import { Button, Card, CopyButton, KeyValue, StatTile } from "@/components/ui";
import { IconEdit, IconWarning } from "@/components/ui/icons";
import type { Track } from "@/lib/types";

export function OverviewTab({ track, onEdit }: { track: Track; onEdit: () => void }) {
  const { labels, sessions, update } = useData();
  const { workspaceById, stageById, submissionsByTrack } = useDerived();

  const workspace = track.workspace_id ? workspaceById.get(track.workspace_id) : undefined;
  const stage = track.stage_id ? stageById.get(track.stage_id) : undefined;
  const intendedLabel = labels.find((l) => l.id === track.intended_label_id);

  const submissions = submissionsByTrack.get(track.id) ?? [];
  const stats = useMemo(() => computeSubmissionStats(submissions), [submissions]);

  const trackSessions = sessions.filter(
    (s) => s.track_id === track.id && s.status === "terminee",
  );
  const totalTime = trackSessions.reduce((sum, s) => sum + s.duration_seconds, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {track.is_blocked ? (
          <Card className="border-danger/30 bg-danger/5 p-4">
            <div className="flex items-start gap-2.5">
              <IconWarning size={18} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-danger">Track bloquée</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {track.blocked_reason || "Aucune raison précisée."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void update("tracks", track.id, { is_blocked: false, blocked_reason: null })
                }
              >
                Lever
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Informations générales
            </h2>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <IconEdit size={15} />
              Modifier
            </Button>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KeyValue label="Espace / alias">{workspace?.name ?? "—"}</KeyValue>
            <KeyValue label="Étape">{stage?.name ?? "—"}</KeyValue>
            <KeyValue label="Priorité">{PRIORITY_LABEL[track.priority]}</KeyValue>
            <KeyValue label="Genre">{track.genre ?? "—"}</KeyValue>
            <KeyValue label="Sous-genre">{track.subgenre ?? "—"}</KeyValue>
            <KeyValue label="BPM">{track.bpm ? Number(track.bpm) : "—"}</KeyValue>
            <KeyValue label="Tonalité">{track.musical_key ?? "—"}</KeyValue>
            <KeyValue label="Date de création">{formatDate(track.created_at)}</KeyValue>
            <KeyValue label="Date cible">{formatDate(track.target_date)}</KeyValue>
            <KeyValue label="Date de sortie">{formatDate(track.release_date)}</KeyValue>
            <KeyValue label="Label envisagé">{intendedLabel?.name ?? "—"}</KeyValue>
            <KeyValue label="Distributeur">{track.distributor ?? "—"}</KeyValue>
            <KeyValue label="Dernière activité">
              {relativeDayLabel(track.last_activity_at)}
            </KeyValue>
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[11px] uppercase tracking-wide text-faint">Projet Ableton</p>
            {track.ableton_path ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-ink-soft">
                  {track.ableton_path}
                </code>
                <CopyButton value={track.ableton_path} label="Copier le chemin" />
              </div>
            ) : (
              <p className="mt-1.5 text-[13px] text-faint">Aucun chemin enregistré.</p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              Le navigateur ne peut pas ouvrir un fichier local : copiez le chemin et collez-le dans
              l&apos;explorateur ou dans Ableton.
            </p>
          </div>
        </Card>

        <NotesCard track={track} />
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Labels contactés" value={stats.sent} />
          <StatTile
            label="Taux de réponse"
            value={stats.sent === 0 ? "—" : `${Math.round(stats.responseRate)} %`}
          />
          <StatTile label="Réponses positives" value={stats.positive} tone="ok" />
          <StatTile label="Refus" value={stats.negative} />
          <StatTile label="Sessions" value={trackSessions.length} />
          <StatTile label="Temps passé" value={formatDuration(totalTime)} />
        </div>
      </div>
    </div>
  );
}

/** Notes générales avec sauvegarde automatique après une courte pause de frappe. */
function NotesCard({ track }: { track: Track }) {
  const { update } = useData();
  const [value, setValue] = useState(track.notes ?? "");
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | null>(null);
  const trackId = track.id;

  useEffect(() => {
    setValue(track.notes ?? "");
    setSaved(true);
  }, [trackId, track.notes]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function onChange(next: string) {
    setValue(next);
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void update("tracks", trackId, { notes: next.trim() || null }).then(() => setSaved(true));
    }, 800);
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Notes générales
        </h2>
        <span className="text-[11px] text-faint">
          {saved ? "Enregistré" : "Enregistrement…"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="Intentions, idées, retours d'écoute…"
        className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed placeholder:text-faint focus:border-accent focus:outline-none"
      />
    </Card>
  );
}
