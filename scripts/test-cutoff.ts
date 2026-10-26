import { seedFixtures, setupTestDb } from "./test-helpers";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const HOUR = 3_600_000;

async function main() {
  const { db, cleanup } = await setupTestDb();

  try {
    await seedFixtures(db);

    const { SETTING_BOOKING_CUTOFF_MINUTES, bookingThreshold, setSetting } =
      await import("../src/lib/settings");

    const now = Date.now();

    // Three windows: soon, in 3 hours, and in 5 days. All are AVAILABLE.
    const soon = await db.slot.create({
      data: {
        startsAt: new Date(now + 30 * 60_000),
        endsAt: new Date(now + 1.5 * HOUR),
      },
    });
    const later = await db.slot.create({
      data: {
        startsAt: new Date(now + 3 * HOUR),
        endsAt: new Date(now + 4 * HOUR),
      },
    });
    const far = await db.slot.create({
      data: {
        startsAt: new Date(now + 5 * 24 * HOUR),
        endsAt: new Date(now + 5 * 24 * HOUR + HOUR),
      },
    });

    // Mirrors the query in /api/slots without importing route handlers.
    const visible = async () => {
      const threshold = await bookingThreshold();
      const rows = await db.slot.findMany({
        where: { status: "AVAILABLE", startsAt: { gte: threshold } },
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, endsAt: true },
      });
      return new Set(rows.map((row) => row.id));
    };

    // Default cutoff is 120 minutes: the window in 30 minutes is hidden.
    const ids = await visible();
    check("2h cutoff: window in 30 min is hidden", !ids.has(soon.id));
    check("2h cutoff: window in 3h is visible", ids.has(later.id));
    check("2h cutoff: window in 5 days is visible", ids.has(far.id));

    // Lower the cutoff to 10 minutes — the 30-minute window appears.
    await setSetting(SETTING_BOOKING_CUTOFF_MINUTES, "10");
    const ids2 = await visible();
    check("10 min cutoff: window in 30 min is visible", ids2.has(soon.id));

    // Zero cutoff — everything is available, including a window starting now.
    await setSetting(SETTING_BOOKING_CUTOFF_MINUTES, "0");
    const ids3 = await visible();
    check(
      "0 cutoff: all windows are visible",
      ids3.has(soon.id) && ids3.has(later.id) && ids3.has(far.id)
    );

    // The threshold is computed from the current time plus the cutoff.
    await setSetting(SETTING_BOOKING_CUTOFF_MINUTES, "90");
    const threshold = await bookingThreshold();
    const deltaMin = Math.round((threshold.getTime() - Date.now()) / 60_000);
    check(
      "threshold equals now + cutoff",
      deltaMin === 89 || deltaMin === 90,
      `threshold in ${deltaMin} min`
    );
  } finally {
    cleanup();
  }
}

main()
  .catch((error) => {
    console.error(error);
    failed++;
  })
  .finally(() => {
    console.log(
      failed ? `\nFAILED checks: ${failed}` : "\nAll cutoff checks passed"
    );
    process.exitCode = failed ? 1 : 0;
  });
