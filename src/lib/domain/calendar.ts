/**
 * Agrégation des évènements datés de l'application pour le calendrier global.
 * Chaque type garde sa couleur et son icône pour être identifiable d'un coup d'œil.
 */

import type {
  ContentItem,
  LabelSubmission,
  PromotionOutreach,
  PromotionTask,
  Track,
  TrackTask,
  WorkSession,
} from "@/lib/types";

export type CalendarEventType =
  | "date_cible"
  | "sortie"
  | "session"
  | "relance_label"
  | "contenu"
  | "envoi_promo"
  | "tache"
  | "tache_promo";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  /** Date au format yyyy-MM-dd. */
  date: string;
  time?: string;
  title: string;
  detail?: string;
  trackId?: string | null;
  href: string;
}

export const EVENT_LABEL: Record<CalendarEventType, string> = {
  date_cible: "Date cible",
  sortie: "Sortie",
  session: "Session",
  relance_label: "Relance label",
  contenu: "Contenu",
  envoi_promo: "Envoi promo",
  tache: "Tâche",
  tache_promo: "Tâche promo",
};

export const EVENT_COLOR: Record<CalendarEventType, string> = {
  date_cible: "#a78bfa",
  sortie: "#fb923c",
  session: "#34d399",
  relance_label: "#fbbf24",
  contenu: "#60a5fa",
  envoi_promo: "#f472b6",
  tache: "#94a3b8",
  tache_promo: "#22d3ee",
};

/** Glyphe court affiché dans les cases du calendrier mensuel. */
export const EVENT_GLYPH: Record<CalendarEventType, string> = {
  date_cible: "◎",
  sortie: "★",
  session: "▶",
  relance_label: "✉",
  contenu: "▣",
  envoi_promo: "➤",
  tache: "•",
  tache_promo: "•",
};

export interface CalendarInput {
  tracks: Track[];
  tasks: TrackTask[];
  promoTasks: PromotionTask[];
  submissions: LabelSubmission[];
  sessions: WorkSession[];
  content: ContentItem[];
  outreach: PromotionOutreach[];
  labelName: (labelId: string) => string;
  trackTitle: (trackId: string | null | undefined) => string;
}

function dayOf(value: string): string {
  return value.slice(0, 10);
}

export function buildCalendarEvents(input: CalendarInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const track of input.tracks) {
    if (track.archived) continue;
    if (track.target_date) {
      events.push({
        id: `cible-${track.id}`,
        type: "date_cible",
        date: track.target_date,
        title: track.title,
        detail: "Date cible",
        trackId: track.id,
        href: `/studio/${track.id}`,
      });
    }
    if (track.release_date) {
      events.push({
        id: `sortie-${track.id}`,
        type: "sortie",
        date: track.release_date,
        title: track.title,
        detail: "Sortie",
        trackId: track.id,
        href: `/studio/${track.id}?onglet=promotion`,
      });
    }
  }

  for (const task of input.tasks) {
    if (!task.due_date) continue;
    if (task.status === "terminee" || task.status === "ignoree") continue;
    events.push({
      id: `tache-${task.id}`,
      type: "tache",
      date: task.due_date,
      title: task.title,
      detail: input.trackTitle(task.track_id),
      trackId: task.track_id,
      href: `/studio/${task.track_id}?onglet=taches`,
    });
  }

  for (const task of input.promoTasks) {
    if (!task.due_date) continue;
    if (task.status === "terminee" || task.status === "ignoree") continue;
    events.push({
      id: `promo-${task.id}`,
      type: "tache_promo",
      date: task.due_date,
      title: task.title,
      detail: `${input.trackTitle(task.track_id)} · ${task.group_key}`,
      trackId: task.track_id,
      href: `/studio/${task.track_id}?onglet=promotion`,
    });
  }

  for (const submission of input.submissions) {
    if (submission.responded || submission.archived) continue;
    if (!submission.followup_due_date) continue;
    events.push({
      id: `relance-${submission.id}`,
      type: "relance_label",
      date: submission.followup_due_date,
      title: `Relancer ${input.labelName(submission.label_id)}`,
      detail: input.trackTitle(submission.track_id),
      trackId: submission.track_id,
      href: `/labels?envoi=${submission.id}`,
    });
  }

  for (const session of input.sessions) {
    const at = session.planned_for ?? (session.status === "terminee" ? session.started_at : null);
    if (!at) continue;
    events.push({
      id: `session-${session.id}`,
      type: "session",
      date: dayOf(at),
      time: at.slice(11, 16),
      title: session.planned_for ? "Session planifiée" : "Session",
      detail: input.trackTitle(session.track_id),
      trackId: session.track_id,
      href: session.track_id ? `/studio/${session.track_id}?onglet=sessions` : "/sessions",
    });
  }

  for (const item of input.content) {
    if (!item.scheduled_at) continue;
    if (item.status === "annule") continue;
    events.push({
      id: `contenu-${item.id}`,
      type: "contenu",
      date: dayOf(item.scheduled_at),
      time: item.scheduled_at.slice(11, 16),
      title: item.title,
      detail: item.platform,
      trackId: item.track_id,
      href: item.track_id ? `/studio/${item.track_id}?onglet=promotion` : "/releases?onglet=contenus",
    });
  }

  for (const item of input.outreach) {
    const date = item.followup_date ?? item.sent_at;
    if (!date) continue;
    events.push({
      id: `outreach-${item.id}`,
      type: "envoi_promo",
      date,
      title: item.followup_date ? "Relance promo" : "Envoi promo",
      detail: input.trackTitle(item.track_id),
      trackId: item.track_id,
      href: `/releases?onglet=envois`,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date);
    if (list) list.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}
