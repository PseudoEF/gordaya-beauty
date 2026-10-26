import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import type { Locale as DateFnsLocale } from "date-fns";

// The whole business (owner and clients) operates in this single timezone,
// regardless of where the server or a visitor's browser happens to be.
export const BUSINESS_TZ = "Europe/Kyiv";

// Interprets a "YYYY-MM-DDTHH:mm" string as Kyiv local time and returns the
// corresponding UTC Date, safe to store in the database.
export function kyivLocalToUtc(localDateTime: string): Date {
  return fromZonedTime(localDateTime, BUSINESS_TZ);
}

export function utcToKyiv(date: Date): Date {
  return toZonedTime(date, BUSINESS_TZ);
}

export function formatKyiv(
  date: Date,
  fmt: string,
  dfnsLocale?: DateFnsLocale
): string {
  return format(toZonedTime(date, BUSINESS_TZ), fmt, {
    timeZone: BUSINESS_TZ,
    locale: dfnsLocale,
  });
}

// "YYYY-MM-DD" for the given UTC instant, as seen in Kyiv — used to group
// slots into calendar days regardless of server timezone.
export function kyivDateKey(date: Date): string {
  return formatKyiv(date, "yyyy-MM-dd");
}

// "YYYY-MM-DDTHH:mm" for the given UTC instant, as seen in Kyiv — the format
// <input type="datetime-local"> expects, and what kyivLocalToUtc reverses.
export function kyivLocalInputValue(date: Date): string {
  return formatKyiv(date, "yyyy-MM-dd'T'HH:mm");
}

// --- Calendar-date ("YYYY-MM-DD") helpers, for building week grids -------
//
// These operate on plain calendar dates (no time-of-day), not real instants,
// so they always use UTC getters/arithmetic on a UTC-midnight Date. That
// keeps them correct no matter what timezone the browser or server is in —
// unlike date-fns' local-time `format`, which would shift the date under a
// negative UTC offset.

export function todayKyivKey(): string {
  return kyivDateKey(new Date());
}

export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// JS day-of-week for a date key: 0 = Sunday ... 6 = Saturday.
export function dateKeyWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function dateKeyDayOfMonth(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDate();
}

// Monday of the week containing dateKey.
export function mondayOfWeek(dateKey: string): string {
  const weekday = dateKeyWeekday(dateKey); // 0=Sun..6=Sat
  const offsetFromMonday = (weekday + 6) % 7;
  return shiftDateKey(dateKey, -offsetFromMonday);
}

// The 7 date keys (Mon..Sun) of the week containing dateKey.
export function buildWeekDays(dateKey: string): string[] {
  const monday = mondayOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(monday, i));
}

// "16.09" — compact day.month for a week-range header, locale-independent.
export function dateKeyShort(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}.${m}`;
}

// Formats a pure calendar date (no time-of-day meaning) with a locale, e.g.
// "середа, 16 вересня". Uses the UTC representation directly instead of
// converting through Kyiv time, since the date key already *is* the Kyiv
// calendar date — no instant/timezone math involved.
export function formatCalendarDate(
  dateKey: string,
  fmt: string,
  dfnsLocale?: DateFnsLocale
): string {
  return format(new Date(`${dateKey}T00:00:00Z`), fmt, {
    timeZone: "UTC",
    locale: dfnsLocale,
  });
}
