"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  EVENT_COLOR,
  EVENT_GLYPH,
  EVENT_LABEL,
  buildCalendarEvents,
  groupEventsByDay,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/domain/calendar";
import { formatDate, todayIso } from "@/lib/format";
import { useLocalState } from "@/lib/hooks";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import { Badge, Button, Card, EmptyState, IconButton, SegmentedControl, cn } from "@/components/ui";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

const ALL_TYPES = Object.keys(EVENT_LABEL) as CalendarEventType[];

export default function CalendarPage() {
  const { tracks, tasks, promoTasks, submissions, sessions, content, outreach, labels } = useData();
  const { inWorkspace } = useUi();

  const [view, setView] = useLocalState<"mois" | "agenda">("atelier.calendrier.vue", "mois");
  const [cursor, setCursor] = useState(() => new Date());
  const [hidden, setHidden] = useLocalState<CalendarEventType[]>("atelier.calendrier.masques", []);
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso());

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const events = useMemo(() => {
    const all = buildCalendarEvents({
      tracks,
      tasks,
      promoTasks,
      submissions,
      sessions,
      content,
      outreach,
      labelName: (id) => labelById.get(id)?.name ?? "un label",
      trackTitle: (id) => (id ? (trackById.get(id)?.title ?? "") : ""),
    });
    return all.filter((event) => {
      if (hidden.includes(event.type)) return false;
      if (!event.trackId) return true;
      const track = trackById.get(event.trackId);
      return track ? inWorkspace(track) : true;
    });
  }, [
    tracks,
    tasks,
    promoTasks,
    submissions,
    sessions,
    content,
    outreach,
    labelById,
    trackById,
    hidden,
    inWorkspace,
  ]);

  const byDay = useMemo(() => groupEventsByDay(events), [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const agenda = useMemo(() => {
    const today = todayIso();
    const upcoming = events.filter((event) => event.date >= today);
    const map = groupEventsByDay(upcoming);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 60);
  }, [events]);

  function toggleType(type: CalendarEventType) {
    setHidden((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "mois", label: "Mois" },
            { value: "agenda", label: "Agenda" },
          ]}
        />

        {view === "mois" ? (
          <div className="flex items-center gap-1">
            <IconButton label="Mois précédent" onClick={() => setCursor((d) => addMonths(d, -1))}>
              <IconChevronLeft size={18} />
            </IconButton>
            <span className="min-w-36 text-center text-[14px] font-medium capitalize">
              {format(cursor, "MMMM yyyy", { locale: fr })}
            </span>
            <IconButton label="Mois suivant" onClick={() => setCursor((d) => addMonths(d, 1))}>
              <IconChevronRight size={18} />
            </IconButton>
            <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>
              Aujourd&apos;hui
            </Button>
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-1">
          {ALL_TYPES.map((type) => {
            const off = hidden.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                  off
                    ? "border-line text-faint"
                    : "border-line-strong bg-surface-2 text-ink-soft",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: off ? "var(--color-faint)" : EVENT_COLOR[type] }}
                  aria-hidden
                />
                {EVENT_LABEL[type]}
              </button>
            );
          })}
        </div>
      </div>

      {view === "mois" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line">
              {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-faint"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const dayEvents = byDay.get(iso) ?? [];
                const outside = !isSameMonth(day, cursor);
                const selected = selectedDay === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDay(iso)}
                    className={cn(
                      "min-h-20 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 hover:bg-surface-2",
                      outside && "opacity-40",
                      selected && "bg-surface-2 ring-1 ring-inset ring-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px]",
                        isToday(day) ? "bg-accent text-white" : "text-muted",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <p
                          key={event.id}
                          className="truncate text-[10px] leading-tight"
                          style={{ color: EVENT_COLOR[event.type] }}
                          title={event.title}
                        >
                          {EVENT_GLYPH[event.type]} {event.title}
                        </p>
                      ))}
                      {dayEvents.length > 3 ? (
                        <p className="text-[10px] text-faint">+{dayEvents.length - 3}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              {selectedDay ? formatDate(selectedDay, "EEEE d MMMM") : "Sélectionnez un jour"}
            </h2>
            {selectedEvents.length === 0 ? (
              <p className="mt-4 text-[13px] text-faint">Aucun évènement ce jour-là.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : agenda.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={28} />}
          title="Aucun évènement à venir"
          description="Les dates cibles, sorties, relances et publications apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {agenda.map(([date, dayEvents]) => (
            <section key={date}>
              <h2 className="mb-2 text-[13px] font-semibold capitalize text-ink-soft">
                {formatDate(date, "EEEE d MMMM")}
                <span className="ml-2 text-[11px] font-normal text-faint">
                  {dayEvents.length} évènement{dayEvents.length > 1 ? "s" : ""}
                </span>
              </h2>
              <Card className="p-3">
                <ul className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: EVENT_COLOR[event.type] }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <Link href={event.href} className="block truncate text-[13px] text-ink hover:text-accent-ink">
          {event.title}
        </Link>
        <p className="truncate text-[11px] text-faint">
          {event.time ? `${event.time} · ` : ""}
          {event.detail}
        </p>
      </div>
      <Badge>{EVENT_LABEL[event.type]}</Badge>
    </li>
  );
}
