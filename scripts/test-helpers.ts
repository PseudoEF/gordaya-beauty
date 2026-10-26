import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Db } from "../src/lib/prisma";
import { applyMigrations } from "./db-utils";

export interface TestDatabase {
  db: Db;
  dbPath: string;
  cleanup: () => void;
}

/**
 * Creates an isolated SQLite database from the real migration SQL, points
 * DATABASE_URL at it, and only then imports the data layer. The data layer
 * opens its connection at module import time, so the order matters.
 */
export async function setupTestDb(): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), "gordaya-test-"));
  const dbPath = join(dir, "test.db");
  applyMigrations(dbPath);

  process.env.DATABASE_URL = `file:${dbPath}`;
  const { prisma } = await import("../src/lib/prisma");

  return {
    db: prisma,
    dbPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Minimal, deterministic fixtures shared by both test suites. */
export async function seedFixtures(db: Db): Promise<void> {
  const manicure = await db.service.create({
    data: {
      slug: "manicure",
      nameUa: "Манікюр",
      nameRu: "Маникюр",
      durationMin: 180,
      priceFrom: 450,
      sortOrder: 1,
    },
  });

  const lashes = await db.service.create({
    data: {
      slug: "lashes",
      nameUa: "Нарощування вій",
      nameRu: "Наращивание ресниц",
      durationMin: 180,
      priceFrom: 600,
      sortOrder: 2,
    },
  });

  await db.priceItem.createMany({
    data: [
      {
        serviceId: manicure.id,
        labelUa: "Демо-манікюр",
        labelRu: "Демо-маникюр",
        amount: 450,
        sortOrder: 0,
      },
      {
        serviceId: manicure.id,
        labelUa: "Демо-френч",
        labelRu: "Демо-френч",
        amount: 100,
        isSurcharge: true,
        sortOrder: 1,
      },
      {
        serviceId: lashes.id,
        labelUa: "Демо-нарощування",
        labelRu: "Демо-наращивание",
        amount: 600,
        sortOrder: 0,
      },
    ],
  });
}
