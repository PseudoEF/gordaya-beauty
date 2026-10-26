"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { uk, ru } from "date-fns/locale";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { LocaleToggle } from "@/components/LocaleToggle";
import {
  formatKyiv,
  formatCalendarDate,
  kyivDateKey,
  kyivLocalInputValue,
  buildWeekDays,
  shiftDateKey,
  mondayOfWeek,
  dateKeyWeekday,
  dateKeyDayOfMonth,
  dateKeyShort,
  todayKyivKey,
} from "@/lib/timezone";
import { DEFAULT_SLOT_DURATION_MIN } from "@/lib/constants";

interface PriceItemDTO {
  id: string;
  labelUa: string;
  labelRu: string;
  amount: number;
  isSurcharge: boolean;
}

interface ServiceDTO {
  id: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  durationMin: number;
  priceFrom: number | null;
  noteUa: string | null;
  noteRu: string | null;
  active: boolean;
  priceItems: PriceItemDTO[];
}

interface BookingDTO {
  id: string;
  clientName: string;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  comment: string | null;
  status: string;
  service: { nameUa: string; nameRu: string };
}

interface SlotDTO {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  booking: BookingDTO | null;
}

interface BookingWithSlotDTO extends BookingDTO {
  createdAt: string;
  slot: { startsAt: string; endsAt: string };
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, values match JS getDay()

export function AdminDashboard() {
  const { t, locale } = useLocale();
  const dfnsLocale = locale === "ua" ? uk : ru;
  const router = useRouter();

  const [tab, setTab] = useState<"slots" | "bookings" | "services" | "settings">("slots");
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [bookings, setBookings] = useState<BookingWithSlotDTO[] | null>(null);

  const [cutoffMinutes, setCutoffMinutes] = useState<string>("");
  const [cutoffMsg, setCutoffMsg] = useState<string | null>(null);
  const [cutoffError, setCutoffError] = useState<string | null>(null);
  const [cutoffSaving, setCutoffSaving] = useState(false);

  const today = todayKyivKey();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(today));
  const [selectedDay, setSelectedDay] = useState(today);

  const [singleDateTime, setSingleDateTime] = useState("");
  const [singleDuration, setSingleDuration] = useState(DEFAULT_SLOT_DURATION_MIN);
  const [singleError, setSingleError] = useState<string | null>(null);

  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bulkTimes, setBulkTimes] = useState("10:00, 14:00, 18:00");
  const [bulkDuration, setBulkDuration] = useState(DEFAULT_SLOT_DURATION_MIN);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  function loadServices() {
    setServices(null);
    fetch("/api/admin/services")
      .then((r) => r.json())
      .then((data) => setServices(data.services ?? []));
  }

  async function loadSlots() {
    setSlots(null);
    const res = await fetch("/api/admin/slots");
    const data = await res.json();
    setSlots(data.slots ?? []);
  }

  async function loadSettings() {
    setCutoffMsg(null);
    setCutoffError(null);
    const res = await fetch("/api/admin/settings");
    if (!res.ok) return;
    const data = await res.json();
    setCutoffMinutes(String(data.bookingCutoffMinutes ?? 120));
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(cutoffMinutes);
    setCutoffSaving(true);
    setCutoffMsg(null);
    setCutoffError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCutoffMinutes: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCutoffError(data.issues?.[0]?.message ?? data.error ?? "Помилка");
        return;
      }
      setCutoffMinutes(String(data.bookingCutoffMinutes));
      setCutoffMsg(t.admin.settingsSaved);
    } catch {
      setCutoffError("Помилка мережі");
    } finally {
      setCutoffSaving(false);
    }
  }

  async function loadBookings() {
    setBookings(null);
    const res = await fetch("/api/admin/bookings");
    const data = await res.json();
    setBookings(data.bookings ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    loadServices();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on tab change
    if (tab === "slots") loadSlots();
    if (tab === "bookings") loadBookings();
    if (tab === "settings") loadSettings();
  }, [tab]);

  // Человеческое описание текущей отсечки, чтобы админ видел эффект
  // настройки до сохранения.
  const cutoffPreview = useMemo(() => {
    const hours = Number(cutoffMinutes) / 60;
    if (!Number.isFinite(hours) || hours <= 0) {
      return locale === "ua"
        ? "Вікна будуть доступні до самого початку"
        : "Окна будут доступны до самого начала";
    }
    const human =
      Number.isInteger(hours) ? `${hours} год` : `${hours.toFixed(1).replace(".", ",")} год`;
    return locale === "ua"
      ? `Вікно зникає зі списку за ${human} до початку`
      : `Окно скрывается из списка за ${human} до начала`;
  }, [cutoffMinutes, locale]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotDTO[]>();
    for (const slot of slots ?? []) {
      const key = kyivDateKey(new Date(slot.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [slots]);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const selectedDaySlots = slotsByDate.get(selectedDay) ?? [];

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!singleDateTime) return;
    setSingleError(null);
    const res = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: singleDateTime,
        durationMin: singleDuration,
      }),
    });
    if (res.ok) {
      setSingleDateTime("");
      loadSlots();
    } else if (res.status === 409) {
      setSingleError(t.admin.slotOverlapError);
    }
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setBulkMsg(null);

    const startTimes = bulkTimes
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{2}:\d{2}$/.test(s));

    const res = await fetch("/api/admin/slots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: bulkFrom,
        toDate: bulkTo,
        daysOfWeek: bulkDays,
        startTimes,
        durationMin: bulkDuration,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setBulkMsg(t.admin.generatedCount(data.created, data.skipped ?? 0));
      loadSlots();
    }
  }

  async function handleToggleBlock(slot: SlotDTO) {
    const nextStatus = slot.status === "BLOCKED" ? "AVAILABLE" : "BLOCKED";
    const res = await fetch(`/api/admin/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) loadSlots();
  }

  async function handleDeleteSlot(slot: SlotDTO) {
    if (!confirm(t.admin.confirmDeleteSlot)) return;
    await fetch(`/api/admin/slots/${slot.id}`, { method: "DELETE" });
    loadSlots();
  }

  async function handleEditSlot(
    slotId: string,
    startsAt: string,
    durationMin: number
  ): Promise<string | null> {
    const res = await fetch(`/api/admin/slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt, durationMin }),
    });
    if (res.ok) {
      loadSlots();
      return null;
    }
    if (res.status === 409) return t.admin.slotOverlapError;
    return t.common.error;
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm(t.admin.confirmCancelBooking)) return;
    await fetch(`/api/admin/bookings/${bookingId}`, { method: "PATCH" });
    loadBookings();
    if (tab === "slots") loadSlots();
  }

  return (
    <div className="min-h-screen px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-2xl font-light text-text sm:text-3xl">
            {t.admin.dashboardTitle}
          </h1>
          <div className="flex items-center gap-3">
            <LocaleToggle />
            <button
              onClick={handleLogout}
              className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {t.admin.logout}
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <TabButton active={tab === "slots"} onClick={() => setTab("slots")}>
            {t.admin.tabSlots}
          </TabButton>
          <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>
            {t.admin.tabBookings}
          </TabButton>
          <TabButton active={tab === "services"} onClick={() => setTab("services")}>
            {t.admin.tabServices}
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            {t.admin.tabSettings}
          </TabButton>
        </div>

        {tab === "slots" && (
          <div>
            <p className="mb-6 text-sm text-text-muted">{t.admin.scheduleNote}</p>

            <div className="grid gap-6 sm:grid-cols-2">
              <form
                onSubmit={handleCreateSlot}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <h2 className="mb-4 font-serif text-lg font-light text-text">
                  {t.admin.createSlotTitle}
                </h2>
                <label
                  htmlFor="single-slot-datetime"
                  className="mb-1 block text-sm text-text-muted"
                >
                  {t.admin.dateTimeLabel}
                </label>
                <input
                  id="single-slot-datetime"
                  type="datetime-local"
                  required
                  value={singleDateTime}
                  onChange={(e) => setSingleDateTime(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
                />
                <label
                  htmlFor="single-slot-duration"
                  className="mb-1 mt-3 block text-sm text-text-muted"
                >
                  {t.admin.durationMinLabel}
                </label>
                <input
                  id="single-slot-duration"
                  type="number"
                  min={15}
                  max={720}
                  step={5}
                  required
                  value={singleDuration}
                  onChange={(e) => setSingleDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
                />
                {singleError && (
                  <p className="mt-2 text-sm text-red-400">{singleError}</p>
                )}
                <button
                  type="submit"
                  className="mt-4 w-full rounded-full bg-accent px-6 py-2.5 text-sm uppercase tracking-[0.2em] text-bg hover:opacity-90"
                >
                  {t.admin.addButton}
                </button>
              </form>

              <form
                onSubmit={handleBulkCreate}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <h2 className="mb-4 font-serif text-lg font-light text-text">
                  {t.admin.bulkTitle}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="bulk-from"
                      className="mb-1 block text-sm text-text-muted"
                    >
                      {t.admin.bulkFrom}
                    </label>
                    <input
                      id="bulk-from"
                      type="date"
                      required
                      value={bulkFrom}
                      onChange={(e) => setBulkFrom(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="bulk-to"
                      className="mb-1 block text-sm text-text-muted"
                    >
                      {t.admin.bulkTo}
                    </label>
                    <input
                      id="bulk-to"
                      type="date"
                      required
                      value={bulkTo}
                      onChange={(e) => setBulkTo(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <span className="mb-1 mt-3 block text-sm text-text-muted">
                  {t.admin.bulkDays}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {WEEK_ORDER.map((day) => {
                    const active = bulkDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() =>
                          setBulkDays((prev) =>
                            active ? prev.filter((d) => d !== day) : [...prev, day]
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          active
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border text-text-muted"
                        }`}
                      >
                        {t.admin.dayNames[day]}
                      </button>
                    );
                  })}
                </div>

                <label
                  htmlFor="bulk-times"
                  className="mb-1 mt-3 block text-sm text-text-muted"
                >
                  {t.admin.bulkTimes}
                </label>
                <input
                  id="bulk-times"
                  type="text"
                  value={bulkTimes}
                  onChange={(e) => setBulkTimes(e.target.value)}
                  placeholder={t.admin.bulkTimesHint}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />
                <p className="mt-1 text-xs text-text-muted">{t.admin.bulkTimesHint}</p>

                <label
                  htmlFor="bulk-duration"
                  className="mb-1 mt-3 block text-sm text-text-muted"
                >
                  {t.admin.durationMinLabel}
                </label>
                <input
                  id="bulk-duration"
                  type="number"
                  min={15}
                  max={720}
                  step={5}
                  required
                  value={bulkDuration}
                  onChange={(e) => setBulkDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />

                <button
                  type="submit"
                  className="mt-4 w-full rounded-full bg-accent px-6 py-2.5 text-sm uppercase tracking-[0.2em] text-bg hover:opacity-90"
                >
                  {t.admin.generateButton}
                </button>
                {bulkMsg && <p className="mt-2 text-sm text-accent">{bulkMsg}</p>}
              </form>
            </div>

            <h2 className="mb-4 mt-10 font-serif text-lg font-light text-text">
              {t.admin.slotsHeading}
            </h2>

            {slots === null && <p className="text-text-muted">{t.common.loading}</p>}

            {slots !== null && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setWeekStart(shiftDateKey(weekStart, -7))}
                    aria-label={t.admin.prevWeek}
                    className="rounded-full border border-border px-3 py-1.5 text-text-muted hover:border-accent hover:text-accent"
                  >
                    ‹
                  </button>
                  <span className="font-serif text-text">
                    {dateKeyShort(weekDays[0])} – {dateKeyShort(weekDays[6])}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeekStart(shiftDateKey(weekStart, 7))}
                    aria-label={t.admin.nextWeek}
                    className="rounded-full border border-border px-3 py-1.5 text-text-muted hover:border-accent hover:text-accent"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 overflow-x-auto sm:gap-2">
                  {weekDays.map((dayKey) => {
                    const daySlots = slotsByDate.get(dayKey) ?? [];
                    const isSelected = dayKey === selectedDay;
                    const isToday = dayKey === today;
                    return (
                      <button
                        type="button"
                        key={dayKey}
                        onClick={() => setSelectedDay(dayKey)}
                        className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors ${
                          isSelected
                            ? "border-accent bg-accent-soft"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <span className="text-[0.6rem] uppercase tracking-wide text-text-muted">
                          {t.admin.dayNames[dateKeyWeekday(dayKey)]}
                        </span>
                        <span
                          className={`font-serif text-lg ${isToday ? "text-accent" : "text-text"}`}
                        >
                          {dateKeyDayOfMonth(dayKey)}
                        </span>
                        <div className="flex w-full flex-col items-center gap-0.5">
                          {daySlots.length === 0 ? (
                            <span className="text-xs text-text-muted">—</span>
                          ) : (
                            <>
                              {daySlots.slice(0, 3).map((s) => (
                                <span
                                  key={s.id}
                                  className={`h-1.5 w-full rounded-full ${
                                    s.status === "BOOKED"
                                      ? "bg-accent"
                                      : s.status === "BLOCKED"
                                        ? "bg-text-muted/40"
                                        : "bg-green-400/70"
                                  }`}
                                />
                              ))}
                              {daySlots.length > 3 && (
                                <span className="text-[0.6rem] text-text-muted">
                                  +{daySlots.length - 3}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <h3 className="mb-3 mt-6 text-sm capitalize text-text-muted">
                  {formatCalendarDate(selectedDay, "EEEE, d MMMM", dfnsLocale)}
                </h3>

                {selectedDaySlots.length === 0 ? (
                  <p className="text-text-muted">{t.admin.noSlotsThisDay}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDaySlots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        onToggleBlock={() => handleToggleBlock(slot)}
                        onDelete={() => handleDeleteSlot(slot)}
                        onEdit={(startsAt, durationMin) =>
                          handleEditSlot(slot.id, startsAt, durationMin)
                        }
                        onCancelBooking={
                          slot.booking
                            ? () => handleCancelBooking(slot.booking!.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "bookings" && (
          <div>
            <h2 className="mb-4 font-serif text-lg font-light text-text">
              {t.admin.bookingsTitle}
            </h2>
            {bookings === null && <p className="text-text-muted">{t.common.loading}</p>}
            {bookings !== null && bookings.length === 0 && (
              <p className="text-text-muted">{t.admin.noBookings}</p>
            )}
            <div className="space-y-3">
              {bookings?.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-lg text-text">
                        {locale === "ua" ? b.service.nameUa : b.service.nameRu}
                      </p>
                      <p className="text-sm text-text-muted">
                        {formatKyiv(
                          new Date(b.slot.startsAt),
                          "EEEE, d MMMM · HH:mm",
                          dfnsLocale
                        )}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                        b.status === "CANCELLED"
                          ? "border-border text-text-muted"
                          : "border-accent text-accent"
                      }`}
                    >
                      {b.status === "CANCELLED"
                        ? t.admin.statusBlocked
                        : t.admin.statusBooked}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-text-muted">
                    <p>
                      {t.admin.client}: <span className="text-text">{b.clientName}</span>
                    </p>
                    <p>
                      {t.admin.contacts}:{" "}
                      <span className="text-text">
                        {b.phone}
                        {b.telegram ? ` · ${b.telegram}` : ""}
                        {b.instagram ? ` · ${b.instagram}` : ""}
                      </span>
                    </p>
                    {b.comment && (
                      <p className="mt-1 italic">&ldquo;{b.comment}&rdquo;</p>
                    )}
                  </div>
                  {b.status !== "CANCELLED" && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      className="mt-3 text-xs uppercase tracking-wide text-red-400 hover:opacity-80"
                    >
                      {t.admin.cancelBooking}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "services" && (
          <div className="space-y-6">
            {services === null && <p className="text-text-muted">{t.common.loading}</p>}
            {services?.map((service) => (
              <ServiceEditor
                key={service.id}
                service={service}
                onSaved={(updated) =>
                  setServices((prev) =>
                    prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev
                  )
                }
              />
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-2xl">
            <form
              onSubmit={saveSettings}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <h3 className="mb-1 text-sm uppercase tracking-[0.2em] text-text-muted">
                {t.admin.settingsTitle}
              </h3>
              <p className="mb-5 text-sm text-text-muted">{t.admin.settingsHint}</p>

              <label
                htmlFor="cutoff-minutes"
                className="mb-1 block text-sm text-text-muted"
              >
                {t.admin.settingsCutoffLabel}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="cutoff-minutes"
                  type="number"
                  min={0}
                  max={10080}
                  step={15}
                  value={cutoffMinutes}
                  onChange={(e) => setCutoffMinutes(e.target.value)}
                  className="w-40 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
                />
                <span className="text-sm text-text-muted">хв</span>
                {[0, 60, 120, 180, 240].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCutoffMinutes(String(preset))}
                    className="rounded-full border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {preset === 0 ? "0" : `${preset / 60} год`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-muted">{cutoffPreview}</p>

              <div className="mt-5 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={cutoffSaving}
                  className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-bg transition-opacity disabled:opacity-50"
                >
                  {t.admin.settingsSave}
                </button>
                {cutoffMsg && (
                  <span className="text-sm text-emerald-400">{cutoffMsg}</span>
                )}
                {cutoffError && (
                  <span className="text-sm text-red-400">{cutoffError}</span>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-5 py-2 text-sm transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-text-muted hover:border-accent/50"
      }`}
    >
      {children}
    </button>
  );
}

function SlotRow({
  slot,
  onToggleBlock,
  onDelete,
  onEdit,
  onCancelBooking,
}: {
  slot: SlotDTO;
  onToggleBlock: () => void;
  onDelete: () => void;
  onEdit: (startsAt: string, durationMin: number) => Promise<string | null>;
  onCancelBooking?: () => void;
}) {
  const { t, locale } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [editDateTime, setEditDateTime] = useState("");
  const [editDuration, setEditDuration] = useState(DEFAULT_SLOT_DURATION_MIN);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const time =
    formatKyiv(new Date(slot.startsAt), "HH:mm") +
    "–" +
    formatKyiv(new Date(slot.endsAt), "HH:mm");

  const statusLabel =
    slot.status === "BOOKED"
      ? t.admin.statusBooked
      : slot.status === "BLOCKED"
        ? t.admin.statusBlocked
        : t.admin.statusAvailable;

  const statusColor =
    slot.status === "BOOKED"
      ? "text-accent border-accent"
      : slot.status === "BLOCKED"
        ? "text-text-muted border-border"
        : "text-green-400 border-green-400/50";

  const serviceName = slot.booking
    ? locale === "ua"
      ? slot.booking.service.nameUa
      : slot.booking.service.nameRu
    : null;

  function startEditing() {
    setEditDateTime(kyivLocalInputValue(new Date(slot.startsAt)));
    setEditDuration(
      Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000)
    );
    setEditError(null);
    setIsEditing(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const error = await onEdit(editDateTime, editDuration);
    setSaving(false);
    if (error) {
      setEditError(error);
    } else {
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSaveEdit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-accent/60 bg-card px-4 py-3"
      >
        <div>
          <label
            htmlFor={`${slot.id}-edit-dt`}
            className="mb-1 block text-xs text-text-muted"
          >
            {t.admin.dateTimeLabel}
          </label>
          <input
            id={`${slot.id}-edit-dt`}
            type="datetime-local"
            required
            value={editDateTime}
            onChange={(e) => setEditDateTime(e.target.value)}
            className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${slot.id}-edit-dur`}
            className="mb-1 block text-xs text-text-muted"
          >
            {t.admin.durationMinLabel}
          </label>
          <input
            id={`${slot.id}-edit-dur`}
            type="number"
            min={15}
            max={720}
            step={5}
            required
            value={editDuration}
            onChange={(e) => setEditDuration(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
        </div>
        {editError && <p className="text-sm text-red-400">{editError}</p>}
        <div className="flex gap-2 text-xs uppercase tracking-wide">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-bg disabled:opacity-50"
          >
            {t.admin.saveEdit}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-full border border-border px-4 py-1.5 text-text-muted hover:text-text"
          >
            {t.admin.cancelEdit}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-serif text-text">{time}</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs uppercase ${statusColor}`}>
          {statusLabel}
        </span>
        {slot.booking && serviceName && (
          <span className="text-sm text-text-muted">
            <span className="text-accent">{serviceName}</span> · {slot.booking.clientName} ·{" "}
            {slot.booking.phone}
          </span>
        )}
      </div>
      <div className="flex gap-2 text-xs uppercase tracking-wide">
        {slot.status !== "BOOKED" && (
          <button onClick={startEditing} className="text-text-muted hover:text-accent">
            {t.admin.editSlot}
          </button>
        )}
        {slot.status !== "BOOKED" && (
          <button onClick={onToggleBlock} className="text-text-muted hover:text-accent">
            {slot.status === "BLOCKED" ? t.admin.unblock : t.admin.block}
          </button>
        )}
        {slot.status === "BOOKED" && onCancelBooking && (
          <button onClick={onCancelBooking} className="text-red-400 hover:opacity-80">
            {t.admin.cancelBooking}
          </button>
        )}
        {slot.status !== "BOOKED" && (
          <button onClick={onDelete} className="text-red-400 hover:opacity-80">
            {t.admin.deleteSlot}
          </button>
        )}
      </div>
    </div>
  );
}

function ServiceEditor({
  service,
  onSaved,
}: {
  service: ServiceDTO;
  onSaved: (updated: ServiceDTO) => void;
}) {
  const { t, locale } = useLocale();
  const [nameUa, setNameUa] = useState(service.nameUa);
  const [nameRu, setNameRu] = useState(service.nameRu);
  const [durationMin, setDurationMin] = useState(service.durationMin);
  const [priceFrom, setPriceFrom] = useState<string>(
    service.priceFrom != null ? String(service.priceFrom) : ""
  );
  const [noteUa, setNoteUa] = useState(service.noteUa ?? "");
  const [noteRu, setNoteRu] = useState(service.noteRu ?? "");
  const [active, setActive] = useState(service.active);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(service.priceItems);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameUa,
        nameRu,
        durationMin,
        priceFrom: priceFrom.trim() === "" ? null : Number(priceFrom),
        noteUa: noteUa.trim() === "" ? null : noteUa,
        noteRu: noteRu.trim() === "" ? null : noteRu,
        active,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onSaved({ ...data.service, priceItems: items });
      setSaved(true);
    }
  }

  const displayName = locale === "ua" ? service.nameUa : service.nameRu;

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="mb-4 font-serif text-lg font-light text-text">{displayName}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${service.id}-nameUa`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.serviceNameUaLabel}
          </label>
          <input
            id={`${service.id}-nameUa`}
            type="text"
            required
            value={nameUa}
            onChange={(e) => setNameUa(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${service.id}-nameRu`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.serviceNameRuLabel}
          </label>
          <input
            id={`${service.id}-nameRu`}
            type="text"
            required
            value={nameRu}
            onChange={(e) => setNameRu(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${service.id}-price`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.servicePriceLabel}
          </label>
          <input
            id={`${service.id}-price`}
            type="number"
            min={0}
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${service.id}-duration`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.serviceDurationLabel}
          </label>
          <input
            id={`${service.id}-duration`}
            type="number"
            min={15}
            max={720}
            step={5}
            required
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${service.id}-noteUa`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.serviceNoteUaLabel}
          </label>
          <textarea
            id={`${service.id}-noteUa`}
            rows={2}
            value={noteUa}
            onChange={(e) => setNoteUa(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor={`${service.id}-noteRu`}
            className="mb-1 block text-sm text-text-muted"
          >
            {t.admin.serviceNoteRuLabel}
          </label>
          <textarea
            id={`${service.id}-noteRu`}
            rows={2}
            value={noteRu}
            onChange={(e) => setNoteRu(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none focus:border-accent"
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
        />
        {t.admin.serviceActiveLabel}
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-2.5 text-sm uppercase tracking-[0.2em] text-bg hover:opacity-90 disabled:opacity-50"
        >
          {t.common.save}
        </button>
        {saved && <span className="text-sm text-accent">{t.admin.serviceSaved}</span>}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-text-muted">
          {t.admin.priceItemsTitle}
        </h3>
        <PriceItemsEditor serviceId={service.id} items={items} onItemsChange={setItems} />
      </div>
    </form>
  );
}

function PriceItemsEditor({
  serviceId,
  items,
  onItemsChange,
}: {
  serviceId: string;
  items: PriceItemDTO[];
  onItemsChange: (items: PriceItemDTO[]) => void;
}) {
  const { t } = useLocale();
  const [newLabelUa, setNewLabelUa] = useState("");
  const [newLabelRu, setNewLabelRu] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSurcharge, setNewSurcharge] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newLabelUa.trim() || !newLabelRu.trim() || newAmount.trim() === "") return;
    setAdding(true);
    const res = await fetch("/api/admin/price-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        labelUa: newLabelUa,
        labelRu: newLabelRu,
        amount: Number(newAmount),
        isSurcharge: newSurcharge,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const data = await res.json();
      onItemsChange([...items, data.item]);
      setNewLabelUa("");
      setNewLabelRu("");
      setNewAmount("");
      setNewSurcharge(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.admin.confirmDeletePriceItem)) return;
    await fetch(`/api/admin/price-items/${id}`, { method: "DELETE" });
    onItemsChange(items.filter((i) => i.id !== id));
  }

  function handleUpdateLocal(id: string, patch: Partial<PriceItemDTO>) {
    onItemsChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleSaveItem(item: PriceItemDTO) {
    await fetch(`/api/admin/price-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelUa: item.labelUa,
        labelRu: item.labelRu,
        amount: item.amount,
        isSurcharge: item.isSurcharge,
      }),
    });
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-elevated p-2.5"
        >
          <input
            value={item.labelUa}
            onChange={(e) => handleUpdateLocal(item.id, { labelUa: e.target.value })}
            onBlur={() => handleSaveItem(item)}
            placeholder="UA"
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            value={item.labelRu}
            onChange={(e) => handleUpdateLocal(item.id, { labelRu: e.target.value })}
            onBlur={() => handleSaveItem(item)}
            placeholder="RU"
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            type="number"
            value={item.amount}
            onChange={(e) => handleUpdateLocal(item.id, { amount: Number(e.target.value) })}
            onBlur={() => handleSaveItem(item)}
            className="w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={item.isSurcharge}
              onChange={(e) => {
                const isSurcharge = e.target.checked;
                handleUpdateLocal(item.id, { isSurcharge });
                handleSaveItem({ ...item, isSurcharge });
              }}
            />
            +
          </label>
          <button
            type="button"
            onClick={() => handleDelete(item.id)}
            className="text-xs uppercase text-red-400 hover:opacity-80"
          >
            {t.admin.deleteSlot}
          </button>
        </div>
      ))}

      {/* A plain div, not <form> — this already sits inside ServiceEditor's
          own <form>, and HTML doesn't allow nested forms (it silently
          mangles the DOM in a browser, breaking React hydration for
          everything after it). Enter-to-submit is wired up manually below. */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          value={newLabelUa}
          onChange={(e) => setNewLabelUa(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t.admin.serviceNameUaLabel}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
        <input
          value={newLabelRu}
          onChange={(e) => setNewLabelRu(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t.admin.serviceNameRuLabel}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
        <input
          type="number"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t.admin.priceItemAmountLabel}
          className="w-24 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
        <label className="flex items-center gap-1 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={newSurcharge}
            onChange={(e) => setNewSurcharge(e.target.checked)}
          />
          +
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="rounded-full border border-accent px-4 py-1.5 text-xs uppercase tracking-wide text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          {t.admin.addPriceItem}
        </button>
      </div>
    </div>
  );
}
