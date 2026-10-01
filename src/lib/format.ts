import type { Appointment } from "../services/api";

const LOCALE = "es-PY";

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO() {
  return toISODate(new Date());
}

/** "YYYY-MM-DD" → Date local (sin el corrimiento de zona horaria de `new Date(iso)`). */
export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "2026-09-30" → "Miércoles, 30 de septiembre de 2026" */
export function formatDateLong(iso: string) {
  return capitalize(
    parseISODate(iso).toLocaleDateString(LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
}

/** Fecha+hora ISO del backend → "30/09/2026" */
export function formatDateShort(datetime: string) {
  return new Date(datetime).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Fecha+hora ISO del backend → "09:30" */
export function formatTime(datetime: string) {
  return new Date(datetime).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function formatMonthYear(year: number, month: number) {
  return capitalize(new Date(year, month, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" }));
}

/** "4567890" → "4.567.890" (solo para mostrar; al backend se manda sin puntos). */
export function formatCI(ci: string) {
  return ci.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// CONFIRMADA es el estado inicial de todo turno: para el doctor es "pendiente de atender".
export const STATUS_LABEL: Record<Appointment["status"], string> = {
  CONFIRMADA: "Pendiente",
  ATENDIDA: "Atendida",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelada",
};
