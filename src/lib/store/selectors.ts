"use client";

import { useMemo } from "react";
import { daysSince } from "@/lib/format";
import { trackProgress, type TrackProgress } from "@/lib/domain/progress";
import { submissionTiming } from "@/lib/domain/submissions";
import { computeSuggestions, type Suggestion } from "@/lib/domain/next-action";
import { useData } from "./data";
import { useUi } from "./ui";
import type {
  AudioVersion,
  Label,
  LabelSubmission,
  PromotionCampaign,
  PromotionTask,
  Stage,
  TimestampNote,
  Track,
  TrackTask,
  Workspace,
} from "@/lib/types";

function groupBy<T, K extends string>(items: T[], key: (item: T) => K | null): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export interface Derived {
  trackById: Map<string, Track>;
  stageById: Map<string, Stage>;
  workspaceById: Map<string, Workspace>;
  labelById: Map<string, Label>;
  tasksByTrack: Map<string, TrackTask[]>;
  promoTasksByTrack: Map<string, PromotionTask[]>;
  progressByTrack: Map<string, TrackProgress>;
  submissionsByTrack: Map<string, LabelSubmission[]>;
  submissionsByLabel: Map<string, LabelSubmission[]>;
  campaignByTrack: Map<string, PromotionCampaign>;
  versionsByTrack: Map<string, AudioVersion[]>;
  notesByVersion: Map<string, TimestampNote[]>;
  /** Étapes visibles du pipeline, triées. */
  activeStages: Stage[];
  /** Tracks non archivées de l'espace sélectionné. */
  visibleTracks: Track[];
  /** Tracks sans activité depuis le seuil défini dans les paramètres. */
  inactiveTracks: Track[];
  suggestions: Suggestion[];
  /** Relances de label à faire (aujourd'hui ou en retard). */
  dueFollowups: LabelSubmission[];
  inactivityDays: number;
}

export function useDerived(): Derived {
  const data = useData();
  const { inWorkspace } = useUi();
  const inactivityDays = data.profile?.inactivity_days ?? 7;

  return useMemo(() => {
    const trackById = new Map(data.tracks.map((t) => [t.id, t]));
    const stageById = new Map(data.stages.map((s) => [s.id, s]));
    const workspaceById = new Map(data.workspaces.map((w) => [w.id, w]));
    const labelById = new Map(data.labels.map((l) => [l.id, l]));

    const tasksByTrack = groupBy(data.tasks, (t) => t.track_id);
    const promoTasksByTrack = groupBy(data.promoTasks, (t) => t.track_id);
    const submissionsByTrack = groupBy(data.submissions, (s) => s.track_id);
    const submissionsByLabel = groupBy(data.submissions, (s) => s.label_id);
    const versionsByTrack = groupBy(data.audioVersions, (v) => v.track_id);
    const notesByVersion = groupBy(data.timestampNotes, (n) => n.audio_version_id);

    const campaignByTrack = new Map(data.campaigns.map((c) => [c.track_id, c]));

    const progressByTrack = new Map<string, TrackProgress>();
    for (const track of data.tracks) {
      progressByTrack.set(
        track.id,
        trackProgress(tasksByTrack.get(track.id) ?? [], promoTasksByTrack.get(track.id) ?? []),
      );
    }

    const activeStages = data.stages
      .filter((s) => !s.archived)
      .sort((a, b) => a.position - b.position);

    const visibleTracks = data.tracks
      .filter((t) => !t.archived && inWorkspace(t))
      .sort((a, b) => a.position - b.position);

    const inactiveTracks = visibleTracks.filter((t) => {
      const idle = daysSince(t.last_activity_at);
      return idle !== null && idle >= inactivityDays;
    });

    const dueFollowups = data.submissions.filter((s) => {
      if (s.archived || s.responded) return false;
      const track = trackById.get(s.track_id);
      if (!track || !inWorkspace(track)) return false;
      return submissionTiming(s).needsFollowup;
    });

    const suggestions = computeSuggestions({
      tracks: data.tracks.filter(inWorkspace),
      tasks: data.tasks,
      promoTasks: data.promoTasks,
      submissions: data.submissions,
      labels: data.labels,
      inactivityDays,
    });

    return {
      trackById,
      stageById,
      workspaceById,
      labelById,
      tasksByTrack,
      promoTasksByTrack,
      progressByTrack,
      submissionsByTrack,
      submissionsByLabel,
      campaignByTrack,
      versionsByTrack,
      notesByVersion,
      activeStages,
      visibleTracks,
      inactiveTracks,
      suggestions,
      dueFollowups,
      inactivityDays,
    };
  }, [data, inWorkspace, inactivityDays]);
}
