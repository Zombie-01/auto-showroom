import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
const defaultMigrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export interface DbHandle { db: Db; close(): Promise<void>; driver: 'postgres' | 'pglite' }

/**
 * DATABASE_URL=postgres://…   → real PostgreSQL (production, staging, local server)
 * otherwise                   → PGlite (embedded PostgreSQL 17 in WASM). PGLITE_DIR persists it;
 *                               "memory://" for tests.
 */
export async function openDb(opts: { url?: string; pgliteDir?: string } = {}): Promise<DbHandle> {
  const url = opts.url ?? process.env.DATABASE_URL;
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? defaultMigrations;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db, driver: 'postgres', close: () => pool.end() };
  }
  const dir = opts.pgliteDir ?? process.env.PGLITE_DIR ?? '.data/pglite';
  // Loaded lazily so production bundles (DATABASE_URL set) never pull in the WASM build.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate: migratePglite } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db: db as unknown as Db, driver: 'pglite', close: () => client.close() };
}
