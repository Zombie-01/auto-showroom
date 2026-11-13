import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { openDb, type DbHandle } from './db/client';
import { DEMO_PASSWORD, seed } from './db/seed';
import { components as lcComponents, vehicle as lcVehicle, variants as lcVariants, colors as lcColors } from './catalog/land-cruiser-300';
import { CATALOG } from './db/seed';
import { ColorInput, VariantInput, VehicleInput } from '@showroom/shared';
import manifest from '../../web/public/assets/vehicles/toyota/land-cruiser-300/demo.manifest.json';

let h: DbHandle;
let app: ReturnType<typeof createApp>;
const A = 'dealer-a.example.com';
const B = 'dealer-b.example.com';

async function login(host: string, email: string, password = DEMO_PASSWORD) {
  const res = await request(app).post('/api/dealer/auth/login').set('Host', host).send({ email, password });
  return { res, cookie: res.headers['set-cookie'] as unknown as string[] | undefined };
}

beforeAll(async () => {
  h = await openDb({ url: '', pgliteDir: 'memory://' });
  await seed(h.db);
  app = createApp(h.db, { trustProxy: false, allowTenantOverride: false, secureCookies: false, rateLimit: false });
}, 60_000);
afterAll(async () => { await h.close(); });

describe('tenant resolution', () => {
  it('resolves tenant from Host and rejects unknown hosts', async () => {
    expect((await request(app).get('/api/public/tenant').set('Host', A)).body.slug).toBe('dealer-a');
    expect((await request(app).get('/api/public/tenant').set('Host', `${B}:443`)).body.slug).toBe('dealer-b');
    expect((await request(app).get('/api/public/tenant').set('Host', 'evil.example.org')).status).toBe(404);
  });
  it('ignores ?tenant override when disabled', async () => {
    expect((await request(app).get('/api/public/tenant?tenant=dealer-b').set('Host', 'unknown.test')).status).toBe(404);
  });
  it('lists only the tenant’s own published vehicles', async () => {
    const a = (await request(app).get('/api/public/vehicles').set('Host', A)).body as { slug: string }[];
    const b = (await request(app).get('/api/public/vehicles').set('Host', B)).body as { slug: string }[];
    expect(a.map((v) => v.slug)).toEqual(['land-cruiser-300', 'lx-600', 'land-cruiser-250', 'gx-550', 't2', 'dashing', 'song-plus']);
    expect(b.map((v) => v.slug)).toEqual(['land-cruiser-300', 'lx-600', 'song-plus']);
    expect((await request(app).get('/api/public/vehicles/t2').set('Host', B)).status).toBe(404);
  });
  it('never shows a price that was not configured', async () => {
    const a = (await request(app).get('/api/public/vehicles').set('Host', A)).body as { startingPrice: unknown }[];
    expect(a.every((v) => v.startingPrice === null)).toBe(true);
  });
});

describe('dealer auth', () => {
  it('rejects wrong password and cross-tenant login with the same error', async () => {
    const wrong = await login(A, 'owner@dealer-a.example.com', 'nope');
    const cross = await login(B, 'owner@dealer-a.example.com');
    expect(wrong.res.status).toBe(401);
    expect(cross.res.status).toBe(401);
    expect(wrong.res.body.error).toBe(cross.res.body.error);
  });
  it('issues an httpOnly session cookie', async () => {
    const { res, cookie } = await login(A, 'owner@dealer-a.example.com');
    expect(res.status).toBe(200);
    expect(cookie?.[0]).toMatch(/HttpOnly/i);
    expect((await request(app).get('/api/dealer/me').set('Host', A).set('Cookie', cookie!)).body.email).toBe('owner@dealer-a.example.com');
  });
  it('requires a session', async () => {
    expect((await request(app).get('/api/dealer/leads').set('Host', A)).status).toBe(401);
  });
});

describe('tenant isolation', () => {
  let ca: string[]; let cb: string[];
  let bVehicleId: string; let bLeadId: string;
  beforeAll(async () => {
    ca = (await login(A, 'owner@dealer-a.example.com')).cookie!;
    cb = (await login(B, 'owner@dealer-b.example.com')).cookie!;
    bVehicleId = ((await request(app).get('/api/dealer/vehicles').set('Host', B).set('Cookie', cb)).body as { id: string }[])[0]!.id;
    const lead = await request(app).post('/api/public/leads').set('Host', B).send({ type: 'contact', name: 'Customer of B', phone: '+97699000001' });
    bLeadId = lead.body.id;
  });

  it('a session from tenant A is not valid on tenant B’s host', async () => {
    expect((await request(app).get('/api/dealer/leads').set('Host', B).set('Cookie', ca)).status).toBe(401);
  });
  it('A cannot see B’s leads', async () => {
    const leads = (await request(app).get('/api/dealer/leads').set('Host', A).set('Cookie', ca)).body as { id: string }[];
    expect(leads.some((l) => l.id === bLeadId)).toBe(false);
    const customers = (await request(app).get('/api/dealer/customers').set('Host', A).set('Cookie', ca)).body as { phone: string }[];
    expect(customers.some((c) => c.phone === '+97699000001')).toBe(false);
  });
  it('A cannot read, modify or delete B’s records by id', async () => {
    const get = (p: string) => request(app).get(p).set('Host', A).set('Cookie', ca);
    expect((await get(`/api/dealer/vehicles/${bVehicleId}`)).status).toBe(404);
    expect((await request(app).patch(`/api/dealer/vehicles/${bVehicleId}`).set('Host', A).set('Cookie', ca).send({ model: 'pwned' })).status).toBe(404);
    expect((await request(app).patch(`/api/dealer/leads/${bLeadId}`).set('Host', A).set('Cookie', ca).send({ status: 'lost' })).status).toBe(404);
    expect((await request(app).post(`/api/dealer/vehicles/${bVehicleId}/variants`).set('Host', A).set('Cookie', ca).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).post('/api/dealer/inventory').set('Host', A).set('Cookie', ca).send({ vehicleId: bVehicleId })).status).toBe(404);
    expect((await request(app).delete(`/api/dealer/vehicles/${bVehicleId}`).set('Host', A).set('Cookie', ca)).status).toBe(404);
    const bLead = ((await request(app).get('/api/dealer/leads').set('Host', B).set('Cookie', cb)).body as { id: string; status: string }[]).find((l) => l.id === bLeadId);
    expect(bLead?.status).toBe('new');
  });
  it('domains are globally unique — A cannot claim B’s hostname', async () => {
    expect((await request(app).post('/api/dealer/domains').set('Host', A).set('Cookie', ca).send({ hostname: B })).status).toBe(409);
  });
  it('malformed ids are 404, not 500', async () => {
    expect((await request(app).get('/api/dealer/vehicles/not-a-uuid').set('Host', A).set('Cookie', ca)).status).toBe(404);
  });
});

describe('leads and pricing', () => {
  it('validates input', async () => {
    const r = await request(app).post('/api/public/leads').set('Host', A).send({ type: 'quote', name: 'B', phone: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.issues.length).toBeGreaterThan(0);
    expect((await request(app).post('/api/public/leads').set('Host', A).set('Content-Type', 'text/plain').send('name=x')).status).toBe(415);
  });
  it('computes estimates server-side and only when the price is configured', async () => {
    const cookie = (await login(A, 'owner@dealer-a.example.com')).cookie!;
    const detail = (await request(app).get('/api/public/vehicles/land-cruiser-300').set('Host', A)).body as { variants: { id: string }[]; colors: { id: string; group: string }[] };
    const variantId = detail.variants[0]!.id;
    const body = detail.colors.find((c) => c.group === 'body')!;
    const cfg = { vehicleSlug: 'land-cruiser-300', variantId, colors: { body: body.id }, switches: { accessories: ['roof_rack'] } };

    const unpriced = await request(app).post('/api/public/leads').set('Host', A).send({ type: 'quote', name: 'Bat', phone: '+97688112233', configuration: cfg });
    expect(unpriced.status).toBe(201);
    expect(unpriced.body.estimatedPrice).toBeNull();

    await request(app).patch(`/api/dealer/variants/${variantId}`).set('Host', A).set('Cookie', cookie).send({ price: 400_000_000 });
    await request(app).patch(`/api/dealer/colors/${body.id}`).set('Host', A).set('Cookie', cookie).send({ priceDelta: 2_000_000 });
    const priced = await request(app).post('/api/public/leads').set('Host', A).send({ type: 'quote', name: 'Bat', phone: '+97688112233', configuration: cfg });
    expect(priced.body.estimatedPrice).toBe(402_000_000);
    expect(priced.body.summary).toEqual(expect.arrayContaining([{ label: 'Их биеийн өнгө', value: expect.any(String) }, { label: 'Дагалдах хэрэгсэл', value: 'Дээврийн тавиур' }]));

    // Another tenant's variant id is rejected
    const bDetail = (await request(app).get('/api/public/vehicles/land-cruiser-300').set('Host', B)).body as { variants: { id: string }[] };
    const bad = await request(app).post('/api/public/leads').set('Host', A).send({ type: 'quote', name: 'Bat', phone: '+97688112233', configuration: { ...cfg, variantId: bDetail.variants[0]!.id } });
    expect(bad.status).toBe(400);

    const customers = (await request(app).get('/api/dealer/customers').set('Host', A).set('Cookie', cookie)).body as { phone: string; leads: number }[];
    expect(customers.find((c) => c.phone === '+97688112233')?.leads).toBe(2);
  });
  it('saves and restores configurations per tenant', async () => {
    const saved = await request(app).post('/api/public/configurations').set('Host', A).send({ vehicleSlug: 'land-cruiser-300', variantId: null, colors: {}, switches: {} });
    expect(saved.status).toBe(201);
    expect((await request(app).get(`/api/public/configurations/${saved.body.code}`).set('Host', A)).status).toBe(200);
    expect((await request(app).get(`/api/public/configurations/${saved.body.code}`).set('Host', B)).status).toBe(404);
  });
  it('records and aggregates analytics', async () => {
    await request(app).post('/api/public/events').set('Host', A).send({ type: 'component_select', vehicleSlug: 'land-cruiser-300', payload: { component: 'turbochargers' } });
    expect((await request(app).post('/api/public/events').set('Host', A).send({ type: 'bogus' })).status).toBe(400);
    const cookie = (await login(A, 'owner@dealer-a.example.com')).cookie!;
    const a = (await request(app).get('/api/dealer/analytics').set('Host', A).set('Cookie', cookie)).body;
    expect(a.componentsTop).toEqual(expect.arrayContaining([{ component: 'turbochargers', n: 1 }]));
  });
});

describe('catalog ↔ manifest consistency', () => {
  it('every manifest component (demo and imported) has editorial info', async () => {
    const infoIds = new Set(lcComponents.map((c) => c.id));
    const manifests: { components: { id: string }[] }[] = [manifest];
    const imported = new URL('../../web/public/assets/vehicles/toyota/land-cruiser-300/vehicle.manifest.json', import.meta.url);
    const { existsSync, readFileSync } = await import('node:fs');
    if (existsSync(imported)) manifests.push(JSON.parse(readFileSync(imported, 'utf8')));
    for (const m of manifests) expect(m.components.map((c) => c.id).filter((id) => !infoIds.has(id))).toEqual([]);
  });
  it('every catalogue vehicle with a 3D manifest has info for each of its components', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    for (const { vehicle } of Object.values(CATALOG)) {
      if (!vehicle.manifestUrl) continue;
      const file = new URL(`../../web/public${vehicle.manifestUrl}`, import.meta.url);
      if (!existsSync(file)) continue; // evaluation assets are git-ignored; checked when present
      const m = JSON.parse(readFileSync(file, 'utf8')) as { components: { id: string }[] };
      const info = new Set(vehicle.components.map((c) => c.id));
      expect(m.components.map((c) => c.id).filter((id) => !info.has(id)), vehicle.slug).toEqual([]);
    }
  });
  it('no seeded value is marked verified — only a dealer can verify', () => {
    const all = [...Object.values(lcComponents.flatMap((c) => c.technical))];
    expect(all.some((s) => s.status === 'verified')).toBe(false);
  });
});

describe('seed catalogue integrity', () => {
  it('passes the same strict schema dealers are held to', () => {
    for (const v of Object.values(CATALOG).map((e) => e.vehicle)) {
      const r = VehicleInput.safeParse(v);
      expect(r.success, `${v.slug}: ${r.error?.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`).toBe(true);
    }
    for (const e of Object.values(CATALOG)) {
      for (const v of e.variants) expect(VariantInput.safeParse(v).success).toBe(true);
      for (const c of e.colors) expect(ColorInput.safeParse(c).success, c.name).toBe(true);
    }
  });
  it('seeds no prices; only the official Toyota body colours are factory-marked', () => {
    expect(Object.values(CATALOG).every((e) => e.variants.every((v) => v.price === null))).toBe(true);
    const factory = lcColors.filter((c) => c.availability === 'factory-verified');
    expect(factory.map((c) => c.name.split(' — ')[0])).toEqual(['White Pearl Crystal Shine', 'Precious White Pearl', 'Silver Metallic', 'Gray Metallic', 'Attitude Black Mica']);
    expect(lcColors.filter((c) => c.group !== 'body').every((c) => c.availability === 'demonstration')).toBe(true);
  });
  it('rejects a spec value without a source, and a guessed value marked unavailable', () => {
    const bad1 = { ...lcVehicle, specifications: { engine: [{ key: 'x', label: 'X', value: '1', status: 'reference' }] } };
    const bad2 = { ...lcVehicle, specifications: { engine: [{ key: 'x', label: 'X', value: '1', status: 'unavailable' }] } };
    expect(VehicleInput.safeParse(bad1).success).toBe(false);
    expect(VehicleInput.safeParse(bad2).success).toBe(false);
  });
});
