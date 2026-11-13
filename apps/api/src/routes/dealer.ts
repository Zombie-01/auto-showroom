import { Router, type NextFunction, type Request, type Response } from 'express';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Branding, ColorInput, Contact, DomainInput, LeadStatus, VariantInput, VehicleInput } from '@showroom/shared';
import type { Db } from '../db/client';
import * as t from '../db/schema';
import { hashToken, newSessionToken, parseCookies, verifyPassword } from '../auth';
import { HttpError, notFound, uuidParam } from '../http';

export const SESSION_COOKIE = 'sr_session';
const SESSION_DAYS = 14;

export function dealerRoutes(db: Db, opts: { secureCookies: boolean; rateLimit: boolean; onDomainsChanged: () => void }) {
  const r = Router();
  const T = (req: Request) => req.dealer!.tenantId;

  // --- Auth ----------------------------------------------------------------------------------
  const Login = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
  r.post('/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: opts.rateLimit ? 10 : 10_000, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    const { email, password } = Login.parse(req.body);
    const [user] = await db.select().from(t.dealerUsers).where(eq(t.dealerUsers.email, email));
    // Same error for unknown user, wrong password and wrong tenant host — no account enumeration.
    const ok = user && user.tenantId === req.tenant.id && (await verifyPassword(password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'И-мэйл эсвэл нууц үг буруу байна');
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
    await db.insert(t.sessions).values({ id: hashToken(token), userId: user.id, tenantId: user.tenantId, expiresAt });
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: opts.secureCookies, expires: expiresAt, path: '/api/dealer' });
    res.json({ email: user.email, name: user.name, role: user.role });
  });

  async function requireSession(req: Request, _res: Response, next: NextFunction) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return next(new HttpError(401, 'Нэвтрээгүй байна'));
    const [row] = await db.select({ s: t.sessions, u: t.dealerUsers }).from(t.sessions)
      .innerJoin(t.dealerUsers, eq(t.dealerUsers.id, t.sessions.userId))
      .where(eq(t.sessions.id, hashToken(token)));
    if (!row || row.s.expiresAt < new Date()) return next(new HttpError(401, 'Нэвтрэлтийн хугацаа дууссан'));
    // A session is only valid on its own tenant's hosts.
    if (row.s.tenantId !== req.tenant.id) return next(new HttpError(401, 'Нэвтрээгүй байна'));
    req.dealer = { userId: row.u.id, tenantId: row.s.tenantId, role: row.u.role, email: row.u.email, name: row.u.name };
    next();
  }
  const ownerOnly = (req: Request, _res: Response, next: NextFunction) => (req.dealer?.role === 'owner' ? next() : next(new HttpError(403, 'Зөвхөн эзэмшигч хийх боломжтой')));

  r.post('/auth/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) await db.delete(t.sessions).where(eq(t.sessions.id, hashToken(token)));
    res.clearCookie(SESSION_COOKIE, { path: '/api/dealer' }).status(204).end();
  });

  r.use(requireSession);
  r.get('/me', (req, res) => res.json({ ...req.dealer, tenant: { slug: req.tenant.slug, branding: req.tenant.branding } }));

  // --- Ownership helpers ---------------------------------------------------------------------
  async function ownedVehicle(req: Request, id: string) {
    const [v] = await db.select().from(t.vehicles).where(and(eq(t.vehicles.id, id), eq(t.vehicles.tenantId, T(req))));
    if (!v) throw notFound('Машин олдсонгүй');
    return v;
  }

  // --- Overview ------------------------------------------------------------------------------
  r.get('/overview', async (req, res) => {
    const tid = T(req);
    const since = new Date(Date.now() - 30 * 86400_000);
    const [[vehicles], [newLeads], [leads30], [views30], recent] = await Promise.all([
      db.select({ n: count() }).from(t.vehicles).where(eq(t.vehicles.tenantId, tid)),
      db.select({ n: count() }).from(t.leads).where(and(eq(t.leads.tenantId, tid), eq(t.leads.status, 'new'))),
      db.select({ n: count() }).from(t.leads).where(and(eq(t.leads.tenantId, tid), gte(t.leads.createdAt, since))),
      db.select({ n: count() }).from(t.analyticsEvents).where(and(eq(t.analyticsEvents.tenantId, tid), eq(t.analyticsEvents.type, 'vehicle_view'), gte(t.analyticsEvents.createdAt, since))),
      db.select({ id: t.leads.id, name: t.leads.name, type: t.leads.type, status: t.leads.status, createdAt: t.leads.createdAt, summary: t.leads.summary })
        .from(t.leads).where(eq(t.leads.tenantId, tid)).orderBy(desc(t.leads.createdAt)).limit(5),
    ]);
    res.json({ vehicles: vehicles!.n, newLeads: newLeads!.n, leads30: leads30!.n, views30: views30!.n, recentLeads: recent });
  });

  // --- Vehicles ------------------------------------------------------------------------------
  r.get('/vehicles', async (req, res) => {
    res.json(await db.select().from(t.vehicles).where(eq(t.vehicles.tenantId, T(req))).orderBy(asc(t.vehicles.sortOrder)));
  });
  r.post('/vehicles', async (req, res) => {
    const body = VehicleInput.parse(req.body);
    const [v] = await db.insert(t.vehicles).values({ ...body, tenantId: T(req) }).returning();
    res.status(201).json(v);
  });
  r.get('/vehicles/:id', async (req, res) => {
    const v = await ownedVehicle(req, uuidParam(req));
    const [variants, colors, inventory] = await Promise.all([
      db.select().from(t.vehicleVariants).where(and(eq(t.vehicleVariants.vehicleId, v.id), eq(t.vehicleVariants.tenantId, T(req)))).orderBy(asc(t.vehicleVariants.sortOrder)),
      db.select().from(t.vehicleColors).where(and(eq(t.vehicleColors.vehicleId, v.id), eq(t.vehicleColors.tenantId, T(req)))).orderBy(asc(t.vehicleColors.group), asc(t.vehicleColors.sortOrder)),
      db.select().from(t.inventoryItems).where(and(eq(t.inventoryItems.vehicleId, v.id), eq(t.inventoryItems.tenantId, T(req)))),
    ]);
    res.json({ ...v, variants, colors, inventory });
  });
  r.patch('/vehicles/:id', async (req, res) => {
    const id = uuidParam(req);
    const body = VehicleInput.partial().parse(req.body);
    const [v] = await db.update(t.vehicles).set({ ...body, updatedAt: new Date() })
      .where(and(eq(t.vehicles.id, id), eq(t.vehicles.tenantId, T(req)))).returning();
    if (!v) throw notFound('Машин олдсонгүй');
    res.json(v);
  });
  r.delete('/vehicles/:id', ownerOnly, async (req, res) => {
    const rows = await db.delete(t.vehicles).where(and(eq(t.vehicles.id, uuidParam(req)), eq(t.vehicles.tenantId, T(req)))).returning({ id: t.vehicles.id });
    if (!rows.length) throw notFound('Машин олдсонгүй');
    res.status(204).end();
  });

  // --- Variants (pricing lives here) -----------------------------------------------------------
  r.post('/vehicles/:id/variants', async (req, res) => {
    const v = await ownedVehicle(req, uuidParam(req));
    const body = VariantInput.parse(req.body);
    const [row] = await db.insert(t.vehicleVariants).values({ ...body, tenantId: T(req), vehicleId: v.id }).returning();
    res.status(201).json(row);
  });
  r.patch('/variants/:id', async (req, res) => {
    const body = VariantInput.partial().parse(req.body);
    const [row] = await db.update(t.vehicleVariants).set(body).where(and(eq(t.vehicleVariants.id, uuidParam(req)), eq(t.vehicleVariants.tenantId, T(req)))).returning();
    if (!row) throw notFound('Хувилбар олдсонгүй');
    res.json(row);
  });
  r.delete('/variants/:id', async (req, res) => {
    const rows = await db.delete(t.vehicleVariants).where(and(eq(t.vehicleVariants.id, uuidParam(req)), eq(t.vehicleVariants.tenantId, T(req)))).returning({ id: t.vehicleVariants.id });
    if (!rows.length) throw notFound('Хувилбар олдсонгүй');
    res.status(204).end();
  });

  // --- Colours ---------------------------------------------------------------------------------
  r.post('/vehicles/:id/colors', async (req, res) => {
    const v = await ownedVehicle(req, uuidParam(req));
    const body = ColorInput.parse(req.body);
    const [row] = await db.insert(t.vehicleColors).values({ ...body, tenantId: T(req), vehicleId: v.id }).returning();
    res.status(201).json(row);
  });
  r.patch('/colors/:id', async (req, res) => {
    const body = ColorInput.partial().parse(req.body);
    const [row] = await db.update(t.vehicleColors).set(body).where(and(eq(t.vehicleColors.id, uuidParam(req)), eq(t.vehicleColors.tenantId, T(req)))).returning();
    if (!row) throw notFound('Өнгө олдсонгүй');
    res.json(row);
  });
  r.delete('/colors/:id', async (req, res) => {
    const rows = await db.delete(t.vehicleColors).where(and(eq(t.vehicleColors.id, uuidParam(req)), eq(t.vehicleColors.tenantId, T(req)))).returning({ id: t.vehicleColors.id });
    if (!rows.length) throw notFound('Өнгө олдсонгүй');
    res.status(204).end();
  });

  // --- Inventory -------------------------------------------------------------------------------
  const InventoryInput = z.object({
    vehicleId: z.string().uuid(), variantId: z.string().uuid().nullable().default(null), colorName: z.string().max(80).default(''),
    vin: z.string().trim().max(17).nullable().default(null), status: z.enum(['in_stock', 'incoming', 'reserved', 'sold']).default('in_stock'),
    quantity: z.number().int().min(0).max(999).default(1), notes: z.string().max(1000).default(''),
  });
  r.get('/inventory', async (req, res) => {
    res.json(await db.select().from(t.inventoryItems).where(eq(t.inventoryItems.tenantId, T(req))).orderBy(desc(t.inventoryItems.createdAt)));
  });
  r.post('/inventory', async (req, res) => {
    const body = InventoryInput.parse(req.body);
    await ownedVehicle(req, body.vehicleId);
    if (body.variantId) {
      const [vr] = await db.select().from(t.vehicleVariants).where(and(eq(t.vehicleVariants.id, body.variantId), eq(t.vehicleVariants.tenantId, T(req)), eq(t.vehicleVariants.vehicleId, body.vehicleId)));
      if (!vr) throw new HttpError(400, 'Энэ хувилбар уг машинд хамаарахгүй');
    }
    const [row] = await db.insert(t.inventoryItems).values({ ...body, tenantId: T(req) }).returning();
    res.status(201).json(row);
  });
  r.patch('/inventory/:id', async (req, res) => {
    const body = InventoryInput.omit({ vehicleId: true, variantId: true }).partial().parse(req.body);
    const [row] = await db.update(t.inventoryItems).set(body).where(and(eq(t.inventoryItems.id, uuidParam(req)), eq(t.inventoryItems.tenantId, T(req)))).returning();
    if (!row) throw notFound('Агуулахын бүртгэл олдсонгүй');
    res.json(row);
  });
  r.delete('/inventory/:id', async (req, res) => {
    const rows = await db.delete(t.inventoryItems).where(and(eq(t.inventoryItems.id, uuidParam(req)), eq(t.inventoryItems.tenantId, T(req)))).returning({ id: t.inventoryItems.id });
    if (!rows.length) throw notFound('Агуулахын бүртгэл олдсонгүй');
    res.status(204).end();
  });

  // --- Leads & customers -------------------------------------------------------------------------
  r.get('/leads', async (req, res) => {
    const status = LeadStatus.optional().parse(req.query.status || undefined);
    const where = status ? and(eq(t.leads.tenantId, T(req)), eq(t.leads.status, status)) : eq(t.leads.tenantId, T(req));
    const rows = await db.select({ lead: t.leads, vehicle: { brand: t.vehicles.brand, model: t.vehicles.model } }).from(t.leads)
      .leftJoin(t.vehicles, and(eq(t.vehicles.id, t.leads.vehicleId), eq(t.vehicles.tenantId, t.leads.tenantId)))
      .where(where).orderBy(desc(t.leads.createdAt)).limit(500);
    res.json(rows.map((r) => ({ ...r.lead, vehicle: r.vehicle?.model ? `${r.vehicle.brand} ${r.vehicle.model}` : null })));
  });
  r.patch('/leads/:id', async (req, res) => {
    const body = z.object({ status: LeadStatus.optional(), notes: z.string().max(5000).optional() }).parse(req.body);
    const [row] = await db.update(t.leads).set({ ...body, updatedAt: new Date() }).where(and(eq(t.leads.id, uuidParam(req)), eq(t.leads.tenantId, T(req)))).returning();
    if (!row) throw notFound('Хүсэлт олдсонгүй');
    res.json(row);
  });
  r.get('/customers', async (req, res) => {
    const rows = await db.select({
      phone: t.leads.phone,
      name: sql<string>`(array_agg(${t.leads.name} order by ${t.leads.createdAt} desc))[1]`,
      email: sql<string | null>`(array_agg(${t.leads.email} order by ${t.leads.createdAt} desc) filter (where ${t.leads.email} is not null))[1]`,
      leads: count(),
      lastContact: sql<string>`max(${t.leads.createdAt})`,
      won: sql<number>`count(*) filter (where ${t.leads.status} = 'won')::int`,
    }).from(t.leads).where(eq(t.leads.tenantId, T(req))).groupBy(t.leads.phone).orderBy(sql`max(${t.leads.createdAt}) desc`).limit(500);
    res.json(rows);
  });

  // --- Analytics -------------------------------------------------------------------------------
  r.get('/analytics', async (req, res) => {
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days ?? undefined);
    const since = new Date(Date.now() - days * 86400_000);
    const scope = and(eq(t.analyticsEvents.tenantId, T(req)), gte(t.analyticsEvents.createdAt, since));
    const [byType, byVehicle, byDay, sections, componentsTop] = await Promise.all([
      db.select({ type: t.analyticsEvents.type, n: count() }).from(t.analyticsEvents).where(scope).groupBy(t.analyticsEvents.type),
      db.select({ vehicle: t.analyticsEvents.vehicleSlug, n: count() }).from(t.analyticsEvents).where(and(scope, eq(t.analyticsEvents.type, 'vehicle_view'))).groupBy(t.analyticsEvents.vehicleSlug),
      db.select({ day: sql<string>`to_char(date_trunc('day', ${t.analyticsEvents.createdAt}), 'YYYY-MM-DD')`, n: count() }).from(t.analyticsEvents).where(scope).groupBy(sql`1`).orderBy(sql`1`),
      db.select({ section: sql<string>`${t.analyticsEvents.payload}->>'section'`, n: count() }).from(t.analyticsEvents).where(and(scope, eq(t.analyticsEvents.type, 'section_view'))).groupBy(sql`1`),
      db.select({ component: sql<string>`${t.analyticsEvents.payload}->>'component'`, n: count() }).from(t.analyticsEvents).where(and(scope, eq(t.analyticsEvents.type, 'component_select'))).groupBy(sql`1`).orderBy(desc(count())).limit(10),
    ]);
    res.json({ days, byType, byVehicle, byDay, sections, componentsTop });
  });

  // --- Branding & domains (owner only) -------------------------------------------------------------
  r.get('/branding', (req, res) => res.json({ branding: req.tenant.branding, contact: req.tenant.contact }));
  r.patch('/branding', ownerOnly, async (req, res) => {
    const body = z.object({ branding: Branding.optional(), contact: Contact.optional() }).parse(req.body);
    const [row] = await db.update(t.tenants).set({ ...(body.branding && { branding: body.branding }), ...(body.contact && { contact: body.contact }) })
      .where(eq(t.tenants.id, T(req))).returning();
    opts.onDomainsChanged();
    res.json({ branding: row!.branding, contact: row!.contact });
  });
  r.get('/domains', async (req, res) => {
    res.json(await db.select().from(t.tenantDomains).where(eq(t.tenantDomains.tenantId, T(req))).orderBy(asc(t.tenantDomains.hostname)));
  });
  r.post('/domains', ownerOnly, async (req, res) => {
    const { hostname } = DomainInput.parse(req.body);
    const [row] = await db.insert(t.tenantDomains).values({ tenantId: T(req), hostname }).returning();
    opts.onDomainsChanged();
    res.status(201).json(row);
  });
  r.delete('/domains/:id', ownerOnly, async (req, res) => {
    const id = uuidParam(req);
    const [{ n }] = (await db.select({ n: count() }).from(t.tenantDomains).where(eq(t.tenantDomains.tenantId, T(req)))) as [{ n: number }];
    if (n <= 1) throw new HttpError(400, 'Дилер дор хаяж нэг домэйнтэй байх ёстой');
    const rows = await db.delete(t.tenantDomains).where(and(eq(t.tenantDomains.id, id), eq(t.tenantDomains.tenantId, T(req)))).returning({ id: t.tenantDomains.id });
    if (!rows.length) throw notFound('Домэйн олдсонгүй');
    opts.onDomainsChanged();
    res.status(204).end();
  });

  return r;
}
