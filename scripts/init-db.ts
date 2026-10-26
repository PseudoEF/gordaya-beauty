import { applyMigrations, resolveDatabasePath } from "./db-utils";

const dbPath = resolveDatabasePath();
const applied = applyMigrations(dbPath);

if (applied.length === 0) {
  console.log(`Database already up to date: ${dbPath}`);
} else {
  console.log(`Applied ${applied.length} migration(s) to ${dbPath}:`);
  for (const name of applied) console.log(`  - ${name}`);
}
