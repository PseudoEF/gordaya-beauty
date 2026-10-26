import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../prisma/migrations", import.meta.url)
);
const MIGRATIONS_TABLE = "_gordaya_migrations";

/**
 * Resolves a SQLite URL/path the same way src/lib/prisma.ts does, so the
 * CLI helpers and the application always agree on which file they mean.
 */
export function resolveDatabasePath(
  databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (!raw) {
    throw new Error("DATABASE_URL does not contain a database path");
  }
  return raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")
    ? raw
    : `./${raw}`;
}

/**
 * Applies every prisma/migrations/<name>/migration.sql in lexical order and
 * records it in a small ledger. SQLite transactions make each migration
 * all-or-nothing, and the ledger makes repeated runs safe.
 */
export function applyMigrations(dbPath: string): string[] {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);

    const alreadyApplied = new Set(
      (
        db.prepare(`SELECT "name" FROM "${MIGRATIONS_TABLE}"`).all() as {
          name: string;
        }[]
      ).map((row) => row.name)
    );

    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const newlyApplied: string[] = [];

    for (const name of migrations) {
      if (alreadyApplied.has(name)) continue;

      const file = join(MIGRATIONS_DIR, name, "migration.sql");
      if (!existsSync(file)) continue;

      const sql = readFileSync(file, "utf8");
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(sql);
        db.prepare(`INSERT INTO "${MIGRATIONS_TABLE}" ("name") VALUES (?)`).run(
          name
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw new Error(`Migration ${name} failed`, { cause: error });
      }
      newlyApplied.push(name);
    }

    // The application creates this table lazily on first use. Doing it here
    // as well means a fresh database is immediately usable by the settings
    // API and the tests.
    db.exec(`CREATE TABLE IF NOT EXISTS "AppSetting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL
    );`);

    return newlyApplied;
  } finally {
    db.close();
  }
}
