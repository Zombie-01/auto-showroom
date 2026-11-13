import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AnalyticsEventType, Configuration, LeadSubmission, startingPrice, type PublicTenant } from '@showroom/shared';
import type { Db } from '../db/client';
import * as t from '../db/schema';
import { HttpError, notFound } from '../http';
import { quote } from '../pricing';

const publicVehicleCols = {
  id: t.vehicles.id, slug: t.vehicles.slug, brand: t.vehicles.brand, model: t.vehicles.model, generation: t.vehicles.generation,
  year: t.vehicles.year, tagline: t.vehicles.tagline, description: t.vehicles.description, manifestUrl: t.vehicles.manifestUrl,
  posterUrl: t.vehicles.posterUrl, sortOrder: t.vehicles.sortOrder,
};

async function publishedVehicle(db: Db, tenantId: string, slug: string) {
  const [v] = await db.select().from(t.vehicles)
    .where(and(eq(t.vehicles.tenantId, tenantId), eq(t.vehicles.slug, slug), eq(t.vehicles.status, 'published')));
  return v ?? null;
}

export function publicRoutes(db: Db, opts: { rateLimit: boolean }) {
  const r = Router();
  const limiter = (limit: number) => rateLimit({ windowMs: 60_000, limit: opts.rateLimit ? limit : 10_000, standardHeaders: 'draft-8', legacyHeaders: false });

  r.get('/tenant', (req, res) => {
    const body: PublicTenant = { slug: req.tenant.slug, branding: req.tenant.branding, contact: req.tenant.contact };
    res.set('Cache-Control', 'public, max-age=60').json(body);
  });

  r.get('/vehicles', async (req, res) => {
    const rows = await db.select(publicVehicleCols).from(t.vehicles)
      .where(and(eq(t.vehicles.tenantId, req.tenant.id), eq(t.vehicles.status, 'published')))
      .orderBy(asc(t.vehicles.sortOrder), asc(t.vehicles.model));
    const variants = await db.select({ vehicleId: t.vehicleVariants.vehicleId, price: t.vehicleVariants.price, currency: t.vehicleVariants.currency })
      .from(t.vehicleVariants).where(eq(t.vehicleVariants.tenantId, req.tenant.id));
    res.set('Cache-Control', 'public, max-age=30').json(rows.map((v) => ({
      ...v, has3d: v.manifestUrl != null, startingPrice: startingPrice(variants.filter((x) => x.vehicleId === v.id)),
    })));
  });

  r.get('/vehicles/:slug', async (req, res) => {
    const v = await publishedVehicle(db, req.tenant.id, req.params.slug);
    if (!v) throw notFound('Машин олдсонгүй');
    const [variants, colors] = await Promise.all([
      db.select().from(t.vehicleVariants).where(and(eq(t.vehicleVariants.tenantId, req.tenant.id), eq(t.vehicleVariants.vehicleId, v.id))).orderBy(asc(t.vehicleVariants.sortOrder)),
      db.select().from(t.vehicleColors).where(and(eq(t.vehicleColors.tenantId, req.tenant.id), eq(t.vehicleColors.vehicleId, v.id))).orderBy(asc(t.vehicleColors.group), asc(t.vehicleColors.sortOrder)),
    ]);
    const { createdAt: _c, updatedAt: _u, status: _s, ...pub } = v;
    res.set('Cache-Control', 'public, max-age=30').json({
      ...pub,
      variants: variants.map(({ tenantId: _t, ...x }) => x),
      colors: colors.map(({ tenantId: _t, ...x }) => x),
    });
  });

  r.post('/leads', limiter(8), async (req, res) => {
    const body = LeadSubmission.parse(req.body);
    let vehicleId: string | null = null;
    let q = quote('—', [], [], undefined);
    if (body.configuration) {
      const v = await publishedVehicle(db, req.tenant.id, body.configuration.vehicleSlug);
      if (!v) throw new HttpError(400, 'Тодорхойгүй машин');
      vehicleId = v.id;
      const [variants, colors] = await Promise.all([
        db.select().from(t.vehicleVariants).where(and(eq(t.vehicleVariants.tenantId, req.tenant.id), eq(t.vehicleVariants.vehicleId, v.id))),
        db.select().from(t.vehicleColors).where(and(eq(t.vehicleColors.tenantId, req.tenant.id), eq(t.vehicleColors.vehicleId, v.id))),
      ]);
      if (body.configuration.variantId && !variants.some((x) => x.id === body.configuration!.variantId)) throw new HttpError(400, 'Тодорхойгүй хувилбар');
      q = quote(`${v.brand} ${v.model}`, variants, colors, body.configuration);
    }
    const [lead] = await db.insert(t.leads).values({
      tenantId: req.tenant.id, vehicleId, type: body.type, name: body.name, phone: body.phone, email: body.email ?? null,
      preferredContact: body.preferredContact, message: body.message ?? null, configuration: body.configuration ?? null,
      summary: q.summary, estimatedPrice: q.estimatedPrice, currency: q.currency,
    }).returning({ id: t.leads.id });
    await db.insert(t.analyticsEvents).values({ tenantId: req.tenant.id, type: 'lead_submitted', vehicleSlug: body.configuration?.vehicleSlug ?? null, payload: { leadType: body.type } });
    res.status(201).json({ id: lead!.id, estimatedPrice: q.estimatedPrice, currency: q.currency, summary: q.summary });
  });

  r.post('/configurations', limiter(30), async (req, res) => {
    const cfg = Configuration.parse(req.body);
    if (!(await publishedVehicle(db, req.tenant.id, cfg.vehicleSlug))) throw new HttpError(400, 'Тодорхойгүй машин');
    const id = randomBytes(6).toString('base64url');
    await db.insert(t.savedConfigurations).values({ id, tenantId: req.tenant.id, vehicleSlug: cfg.vehicleSlug, configuration: cfg });
    res.status(201).json({ code: id });
  });

  r.get('/configurations/:code', async (req, res) => {
    if (!/^[A-Za-z0-9_-]{8}$/.test(req.params.code)) throw notFound();
    const [row] = await db.select().from(t.savedConfigurations)
      .where(and(eq(t.savedConfigurations.id, req.params.code), eq(t.savedConfigurations.tenantId, req.tenant.id)));
    if (!row) throw notFound('Тохиргоо олдсонгүй');
    res.json(row.configuration);
  });

  const EventBody = z.object({ type: AnalyticsEventType, vehicleSlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(), payload: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional() });
  r.post('/events', limiter(120), async (req, res) => {
    const e = EventBody.parse(req.body);
    await db.insert(t.analyticsEvents).values({ tenantId: req.tenant.id, type: e.type, vehicleSlug: e.vehicleSlug ?? null, payload: e.payload ?? {} });
    res.status(204).end();
  });

  return r;
}
