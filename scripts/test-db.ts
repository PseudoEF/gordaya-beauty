import { seedFixtures, setupTestDb } from "./test-helpers";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const now = Date.now();

async function main() {
  const { db, cleanup } = await setupTestDb();

  try {
    await seedFixtures(db);

    const services = await db.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { priceItems: { orderBy: { sortOrder: "asc" } } },
    });
    check("findMany + orderBy + include", services.length === 2, `services: ${services.length}`);
    check(
      "include loads priceItems",
      (services[0]?.priceItems?.length ?? 0) > 0,
      `items on first service: ${services[0]?.priceItems?.length}`
    );
    check(
      "boolean column is returned as boolean",
      services[0]?.active === true,
      `active: ${typeof services[0]?.active}`
    );

    const bySlug = await db.service.findUnique({ where: { slug: "manicure" } });
    check("findUnique by slug", bySlug?.slug === "manicure");

    const created = await db.slot.create({
      data: {
        startsAt: new Date(now + 86_400_000),
        endsAt: new Date(now + 90_000_000),
      },
    });
    check(
      "create",
      typeof created.id === "string" && created.id.startsWith("c"),
      `id: ${String(created.id).slice(0, 12)}…`
    );
    check("create applies the default status", created.status === "AVAILABLE");
    check("create returns dates as Date", created.startsAt instanceof Date);

    const many = await db.slot.createMany({
      data: [
        {
          startsAt: new Date(now + 172_800_000),
          endsAt: new Date(now + 180_000_000),
        },
        {
          startsAt: new Date(now + 259_200_000),
          endsAt: new Date(now + 266_000_000),
        },
      ],
    });
    check("createMany", many.count === 2, `created: ${many.count}`);

    const future = await db.slot.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true },
    });
    check("where gte + select", future.length === 3, `future slots: ${future.length}`);
    check(
      "select returns only requested fields",
      Object.keys(future[0] ?? {}).sort().join(",") === "endsAt,id,startsAt",
      `fields: ${Object.keys(future[0] ?? {}).join(",")}`
    );

    const between = await db.slot.findMany({
      where: {
        startsAt: { gte: new Date(now + 80_000_000) },
        endsAt: { lt: new Date(now + 260_000_000) },
      },
    });
    check("where with two operators (gte + lt)", between.length >= 1, `found: ${between.length}`);

    const updated = await db.slot.update({
      where: { id: created.id },
      data: { status: "BOOKED" },
    });
    check("update", updated.status === "BOOKED");

    const removed = await db.slot.delete({ where: { id: created.id } });
    check("delete", removed.id === created.id);
    check(
      "delete actually removes the row",
      (await db.slot.findUnique({ where: { id: created.id } })) === null
    );

    const nested = await db.slot.findMany({
      include: { booking: { include: { service: true } } },
    });
    check("nested include does not throw", Array.isArray(nested), `slots: ${nested.length}`);

    const upserted = await db.service.upsert({
      where: { slug: "lashes-test" },
      create: { slug: "lashes-test", nameUa: "Вії", nameRu: "Ресницы" },
      update: { nameUa: "Вії нові" },
    });
    check(
      "upsert creates",
      upserted.slug === "lashes-test" && upserted.nameUa === "Вії"
    );
    const upserted2 = await db.service.upsert({
      where: { slug: "lashes-test" },
      create: { slug: "lashes-test", nameUa: "Вії", nameRu: "Ресницы" },
      update: { nameUa: "Вії нові" },
    });
    check("upsert updates", upserted2.nameUa === "Вії нові");
    await db.service.delete({ where: { slug: "lashes-test" } });

    let threw = false;
    try {
      await db.$transaction(async (tx) => {
        await tx.service.update({
          where: { slug: "manicure" },
          data: { nameUa: "ЗМІНЕНО" },
        });
        throw new Error("ROLLBACK");
      });
    } catch {
      threw = true;
    }
    check("transaction rolls back on error", threw);
    const afterRollback = await db.service.findUnique({
      where: { slug: "manicure" },
    });
    check(
      "rollback restores the original value",
      afterRollback?.nameUa !== "ЗМІНЕНО",
      `nameUa: ${afterRollback?.nameUa}`
    );

    await db.$transaction(async (tx) => {
      await tx.service.update({
        where: { slug: "manicure" },
        data: { nameUa: "ЗБЕРЕЖЕНО" },
      });
    });
    const afterCommit = await db.service.findUnique({
      where: { slug: "manicure" },
    });
    check("transaction commits changes", afterCommit?.nameUa === "ЗБЕРЕЖЕНО");

    let rejected = false;
    try {
      await db.service.findMany({
        where: { "nameUa; DROP TABLE Service": "x" },
      } as never);
    } catch {
      rejected = true;
    }
    check("unknown field is rejected (injection guard)", rejected);
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
      failed
        ? `\nFAILED checks: ${failed}`
        : "\nAll database checks passed"
    );
    process.exitCode = failed ? 1 : 0;
  });
