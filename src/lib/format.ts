import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/** Date du jour au format ISO court, en heure locale (pas UTC). */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    const d = value.length <= 10 ? parseISO(`${value}T00:00:00`) : parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy"): string {
  const d = toDate(value);
  return d ? format(d, pattern, { locale: fr }) : "—";
}

export function formatDateLong(value: string | Date | null | undefined): string {
  return formatDate(value, "EEEE d MMMM yyyy");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, "d MMM yyyy 'à' HH:mm");
}

export function formatTime(value: string | Date | null | undefined): string {
  return formatDate(value, "HH:mm");
}

/** Nombre de jours calendaires entre une date et aujourd'hui (passé = positif). */
export function daysSince(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  return differenceInCalendarDays(new Date(), d);
}

/** Nombre de jours calendaires d'ici une date (futur = positif). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}

/** « aujourd'hui », « demain », « il y a 3 jours », « dans 5 jours ». */
export function relativeDayLabel(value: string | Date | null | undefined): string {
  const diff = daysUntil(value);
  if (diff === null) return "—";
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  if (diff > 1) return `dans ${diff} jours`;
  return `il y a ${Math.abs(diff)} jours`;
}

/** Formate une durée en secondes : « 1 h 24 » / « 12 min » / « 45 s ». */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${Math.floor(seconds)} s`;
}

/** Formate un temps de lecture audio : « 2:34 » ou « 1:02:34 ». */
export function formatClock(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Convertit « 2:34 » ou « 154 » en secondes. Retourne null si invalide. */
export function parseClock(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} %`;
}

/** « 3 jours » / « 1 jour ». */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count > 1 ? (pluralForm ?? `${singular}s`) : singular}`;
}
