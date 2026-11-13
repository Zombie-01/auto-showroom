import { mkdirSync } from 'node:fs';
import { createApp } from './app';
import { openDb } from './db/client';
import { DEMO_PASSWORD, seed } from './db/seed';

const isProd = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL) mkdirSync(process.env.PGLITE_DIR ?? '.data', { recursive: true });

const handle = await openDb();
if (!isProd || process.env.SEED_DEMO === 'true') {
  const r = await seed(handle.db);
  if (r.seeded) console.log(`Seeded demo tenants. Dealer login: owner@dealer-a.example.com / ${DEMO_PASSWORD}`);
}

const app = createApp(handle.db, {
  trustProxy: process.env.TRUST_PROXY === 'true',
  allowTenantOverride: !isProd,
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? (isProd ? undefined : 'dealer-a'),
  secureCookies: isProd,
  rateLimit: process.env.RATE_LIMIT !== 'false',
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.log(`API listening on :${port} (${handle.driver})`));
const shutdown = () => server.close(() => void handle.close().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
