import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { tenantDomains, tenants } from './db/schema';
import { HttpError } from './http';

export type Tenant = typeof tenants.$inferSelect;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { tenant: Tenant; dealer?: { userId: string; tenantId: string; role: 'owner' | 'staff'; email: string; name: string } }
  }
}

export interface TenantConfig {
  /** Trust X-Forwarded-Host (only behind a proxy/CDN you control). */
  trustProxy: boolean;
  /** Dev/test only: allow ?tenant= / X-Tenant to pick a tenant when the hostname is unknown. */
  allowTenantOverride: boolean;
  defaultTenantSlug?: string;
}

const CACHE_MS = 30_000;

export function createTenantResolver(db: Db, cfg: TenantConfig) {
  const cache = new Map<string, { tenantId: string | null; at: number }>();
  const byId = new Map<string, { tenant: Tenant; at: number }>();

  async function loadById(id: string): Promise<Tenant | null> {
    const hit = byId.get(id);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.tenant;
    const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (row) byId.set(id, { tenant: row, at: Date.now() });
    return row ?? null;
  }

  async function bySlug(slug: string): Promise<Tenant | null> {
    const [row] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return row ?? null;
  }

  async function resolve(req: Request): Promise<Tenant | null> {
    const raw = (cfg.trustProxy ? (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0] : undefined) ?? req.headers.host ?? '';
    const host = raw.trim().toLowerCase().replace(/:\d+$/, '');
    const cached = cache.get(host);
    let tenantId = cached && Date.now() - cached.at < CACHE_MS ? cached.tenantId : undefined;
    if (tenantId === undefined) {
      const [row] = await db.select({ tenantId: tenantDomains.tenantId }).from(tenantDomains).where(eq(tenantDomains.hostname, host));
      tenantId = row?.tenantId ?? null;
      cache.set(host, { tenantId, at: Date.now() });
    }
    if (tenantId) return loadById(tenantId);
    if (cfg.allowTenantOverride) {
      const override = (req.query.tenant as string | undefined) ?? (req.headers['x-tenant'] as string | undefined);
      if (override && /^[a-z0-9-]{1,63}$/.test(override)) return bySlug(override);
    }
    if (cfg.defaultTenantSlug) return bySlug(cfg.defaultTenantSlug);
    return null;
  }

  return {
    middleware: async (req: Request, _res: Response, next: NextFunction) => {
      const tenant = await resolve(req);
      if (!tenant) return next(new HttpError(404, 'Тодорхойгүй дилер'));
      req.tenant = tenant;
      next();
    },
    invalidate: () => { cache.clear(); byId.clear(); },
  };
}
