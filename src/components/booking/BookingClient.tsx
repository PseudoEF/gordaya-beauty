"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { uk, ru } from "date-fns/locale";
import { useLocale } from "@/lib/i18n/LocaleContext";
import {
  formatKyiv,
  kyivDateKey,
  buildWeekDays,
  shiftDateKey,
  mondayOfWeek,
  dateKeyWeekday,
  dateKeyDayOfMonth,
  dateKeyShort,
  todayKyivKey,
} from "@/lib/timezone";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

interface ServiceDTO {
  id: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  durationMin: number;
  priceFrom: number | null;
}

interface SlotDTO {
  id: string;
  startsAt: string;
  endsAt: string;
}

export function BookingClient({ service }: { service: ServiceDTO }) {
  const { t, locale } = useLocale();
  const dfnsLocale = locale === "ua" ? uk : ru;
  const serviceName = locale === "ua" ? service.nameUa : service.nameRu;

  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const today = todayKyivKey();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(today));
  const [autoJumped, setAutoJumped] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    telegram: "",
    instagram: "",
    comment: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function loadSlots() {
    setSlots(null);
    const res = await fetch(`/api/slots`);
    const data = await res.json();
    setSlots(data.slots ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    loadSlots();
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, SlotDTO[]>();
    for (const slot of slots ?? []) {
      const key = kyivDateKey(new Date(slot.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots]);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const canGoPrev = weekStart > mondayOfWeek(today);
  const weekHasSlots = weekDays.some((d) => (byDate.get(d)?.length ?? 0) > 0);

  // Jump to the first week that actually has openings, once, right after load.
  useEffect(() => {
    if (autoJumped || !slots) return;
    if (slots.length > 0) {
      const earliestWeek = mondayOfWeek(kyivDateKey(new Date(slots[0].startsAt)));
      if (earliestWeek !== weekStart) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time jump to first available week
        setWeekStart(earliestWeek);
      }
    }
    setAutoJumped(true);
  }, [slots, autoJumped, weekStart]);

  const allSlots = slots ?? [];
  const selectedSlot = allSlots.find((s) => s.id === selectedSlotId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          serviceId: service.id,
          ...form,
        }),
      });

      if (res.status === 201) {
        setSuccess(true);
      } else if (res.status === 409) {
        setErrorMsg(t.booking.errorSlotTaken);
        setSelectedSlotId(null);
        loadSlots();
      } else {
        setErrorMsg(t.booking.errorGeneric);
      }
    } catch {
      setErrorMsg(t.booking.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen">
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
          <h1 className="font-serif text-3xl font-light text-text sm:text-4xl">
            {t.booking.successTitle}
          </h1>
          <p className="mt-4 text-text-muted">{t.booking.successText}</p>
          <Link
            href="/"
            className="mt-10 rounded-full border border-accent px-8 py-3 text-sm uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent-soft"
          >
            {t.booking.backHome}
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <Link
          href="/"
          className="text-sm tracking-wide text-text-muted transition-colors hover:text-accent"
        >
          ← {t.booking.back}
        </Link>

        <h1 className="mt-4 font-serif text-3xl font-light text-text sm:text-4xl">
          {serviceName}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{t.booking.durationNote}</p>

        <div className="divider-line my-8" />

        {slots === null && (
          <p className="text-text-muted">{t.common.loading}</p>
        )}

        {slots !== null && allSlots.length === 0 && (
          <p className="text-text-muted">{t.booking.noDates}</p>
        )}

        {slots !== null && allSlots.length > 0 && (
          <>
            <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-text-muted">
              {t.booking.selectDate}
            </h2>

            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => canGoPrev && setWeekStart(shiftDateKey(weekStart, -7))}
                disabled={!canGoPrev}
                aria-label={t.booking.prevWeek}
                className="rounded-full border border-border px-3 py-1.5 text-text-muted enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-serif text-text">
                {dateKeyShort(weekDays[0])} – {dateKeyShort(weekDays[6])}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart(shiftDateKey(weekStart, 7))}
                aria-label={t.booking.nextWeek}
                className="rounded-full border border-border px-3 py-1.5 text-text-muted hover:border-accent hover:text-accent"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((dayKey) => {
                const daySlots = byDate.get(dayKey) ?? [];
                const isPast = dayKey < today;
                const hasSlots = daySlots.length > 0 && !isPast;
                return (
                  <div
                    key={dayKey}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border p-1.5 sm:p-2 ${
                      hasSlots ? "border-border" : "border-border/40 opacity-40"
                    }`}
                  >
                    <span className="text-[0.6rem] uppercase tracking-wide text-text-muted">
                      {t.booking.dayNames[dateKeyWeekday(dayKey)]}
                    </span>
                    <span className="font-serif text-text">
                      {dateKeyDayOfMonth(dayKey)}
                    </span>
                    <div className="flex w-full flex-col gap-1 pt-1">
                      {hasSlots ? (
                        daySlots.map((slot) => {
                          const active = slot.id === selectedSlotId;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`w-full rounded-lg border px-1 py-1.5 text-[0.7rem] leading-none transition-colors sm:text-xs ${
                                active
                                  ? "border-accent bg-accent-soft text-accent"
                                  : "border-border text-text-muted hover:border-accent/50"
                              }`}
                            >
                              {formatKyiv(new Date(slot.startsAt), "HH:mm")}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-center text-xs text-text-muted">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!weekHasSlots && (
              <p className="mt-3 text-sm text-text-muted">{t.booking.noSlotsThisWeek}</p>
            )}
          </>
        )}

        {selectedSlot && (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="divider-line mb-2" />
            <p className="text-sm text-text-muted">
              {t.booking.selectedSummary}:{" "}
              <span className="text-accent">
                {formatKyiv(
                  new Date(selectedSlot.startsAt),
                  "EEEE, d MMMM · HH:mm",
                  dfnsLocale
                )}
              </span>
            </p>

            <h2 className="text-xs uppercase tracking-[0.3em] text-text-muted">
              {t.booking.formTitle}
            </h2>

            <Field
              label={t.booking.nameLabel}
              placeholder={t.booking.namePlaceholder}
              required
              value={form.clientName}
              onChange={(v) => setForm({ ...form, clientName: v })}
            />
            <Field
              label={t.booking.phoneLabel}
              placeholder={t.booking.phonePlaceholder}
              required
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Field
              label={t.booking.telegramLabel}
              placeholder={t.booking.telegramPlaceholder}
              value={form.telegram}
              onChange={(v) => setForm({ ...form, telegram: v })}
            />
            <Field
              label={t.booking.instagramLabel}
              placeholder={t.booking.instagramPlaceholder}
              value={form.instagram}
              onChange={(v) => setForm({ ...form, instagram: v })}
            />
            <div>
              <label className="mb-1 block text-sm text-text-muted">
                {t.booking.commentLabel}
              </label>
              <textarea
                className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none transition-colors focus:border-accent"
                rows={3}
                placeholder={t.booking.commentPlaceholder}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-accent px-6 py-3 text-sm uppercase tracking-[0.2em] text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t.booking.submitting : t.booking.submitButton}
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-text-muted">{label}</label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}
