import { getDb } from '../db';

// Future schema migrations go here.
// Each migration is a function that ALTERs the schema for a specific version.
// The initial schema is created by schema.ts on first open.

const MIGRATIONS: Array<{ version: number; up: (db: any) => Promise<void> }> = [
  // Example:
  // {
  //   version: 2,
  //   up: async (db) => {
  //     await db.execAsync('ALTER TABLE expenses ADD COLUMN receipt_url TEXT');
  //   },
  // },
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  // Ensure migration tracking table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = (await db.getAllAsync(
    'SELECT version FROM schema_migrations ORDER BY version'
  )) as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()]
      );
    }
  }
}