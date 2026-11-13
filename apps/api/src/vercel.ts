// Vercel serverless entry: one function serves every /api/* route. Bundled by scripts/vercel-build.mjs.
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { openDb } from './db/client';
import { seed } from './db/seed';

let ready: Promise<ReturnType<typeof createApp>> | undefined;

async function init() {
  // The bundle ships its migrations next to index.mjs (see scripts/vercel-build.mjs).
  process.env.MIGRATIONS_DIR ??= fileURLToPath(new URL('./drizzle', import.meta.url));
  const handle = await openDb();
  if (process.env.SEED_DEMO === 'true') await seed(handle.db);
  return createApp(handle.db, {
    trustProxy: process.env.TRUST_PROXY === 'true',
    allowTenantOverride: false,
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG,
    secureCookies: true,
    rateLimit: process.env.RATE_LIMIT !== 'false',
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init().catch((err) => { ready = undefined; throw err; });
  const app = await ready;
  return app(req as never, res as never);
}
