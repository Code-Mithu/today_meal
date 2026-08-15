import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'todaymeal.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Database singleton — opens the SQLite database and runs initial schema migration.
 * All repositories use getDb() to obtain the connection.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync(SCHEMA_SQL);
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

// Helper: run a parameterized query and return all rows
export async function queryAll<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const db = await getDb();
  return (await db.getAllAsync(sql, params)) as T[];
}

// Helper: run a parameterized query and return the first row
export async function queryFirst<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(sql, params)) as T | null;
  return row || null;
}

// Helper: execute a write statement
export async function execute(
  sql: string,
  params: any[] = []
): Promise<SQLite.SQLiteRunResult> {
  const db = await getDb();
  return db.runAsync(sql, params);
}

// Helper: run multiple write statements in a transaction
export async function runInTransaction(
  fn: (tx: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await fn(db);
  });
}
