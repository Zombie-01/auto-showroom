import { sql } from 'drizzle-orm';
import type { Db } from './client';
import * as t from './schema';
import { hashPassword } from '../auth';
import * as lc300 from '../catalog/land-cruiser-300';
import * as o from '../catalog/others';
import type { ColorInput, VariantInput, VehicleInput } from '@showroom/shared';

/** Catalogue entries: vehicle content + variants + colours, keyed by slug. */
export const CATALOG: Record<string, { vehicle: VehicleInput; variants: VariantInput[]; colors: ColorInput[] }> = {
  'land-cruiser-300': { vehicle: lc300.vehicle, variants: lc300.variants, colors: lc300.colors },
  'land-cruiser-250': { vehicle: o.lc250, variants: o.lc250Variants, colors: o.lc250Colors },
  'lx-600': { vehicle: o.lx600, variants: o.lx600Variants, colors: o.lx600Colors },
  'gx-550': { vehicle: o.gx550, variants: o.gx550Variants, colors: o.gx550Colors },
  t2: { vehicle: o.jetourT2, variants: o.t2Variants, colors: o.t2Colors },
  dashing: { vehicle: o.dashing, variants: o.dashingVariants, colors: o.dashingColors },
  'song-plus': { vehicle: o.songPlus, variants: o.songPlusVariants, colors: [] },
};

export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'showroom-demo-2026';

interface TenantSeed { slug: string; name: string; accent: string; tagline: string; domains: string[]; vehicles: string[]; owner: string }

const TENANTS: TenantSeed[] = [
  { slug: 'dealer-a', name: 'Demo Motors A', accent: '#c8a46a', tagline: 'Туршилтын дилер', domains: ['dealer-a.localhost', 'dealer-a.example.com'], vehicles: ['land-cruiser-300', 'land-cruiser-250', 'lx-600', 'gx-550', 't2', 'dashing', 'song-plus'], owner: 'owner@dealer-a.example.com' },
  { slug: 'dealer-b', name: 'Demo Motors B', accent: '#7fa7c9', tagline: 'Хоёр дахь туршилтын дилер', domains: ['dealer-b.localhost', 'dealer-b.example.com'], vehicles: ['land-cruiser-300', 'lx-600', 'song-plus'], owner: 'owner@dealer-b.example.com' },
];

/** Idempotent: does nothing if tenants already exist. */
export async function seed(db: Db, opts: { force?: boolean } = {}) {
  const [{ count }] = (await db.execute(sql`select count(*)::int as count from tenants`)).rows as [{ count: number }];
  if (count > 0 && !opts.force) return { seeded: false };
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const ts of TENANTS) {
    const [tenant] = await db.insert(t.tenants).values({
      slug: ts.slug,
      branding: { displayName: ts.name, logoUrl: null, accent: ts.accent, tagline: ts.tagline },
      contact: { phone: '', email: '', address: '', hours: '' },
    }).returning();
    await db.insert(t.tenantDomains).values(ts.domains.map((hostname) => ({ tenantId: tenant!.id, hostname })));
    await db.insert(t.dealerUsers).values({ tenantId: tenant!.id, email: ts.owner, name: `${ts.name} owner`, passwordHash, role: 'owner' });

    for (const slug of ts.vehicles) {
      const entry = CATALOG[slug]!;
      const [veh] = await db.insert(t.vehicles).values({ ...entry.vehicle, tenantId: tenant!.id }).returning();
      if (entry.variants.length) await db.insert(t.vehicleVariants).values(entry.variants.map((x) => ({ ...x, tenantId: tenant!.id, vehicleId: veh!.id })));
      if (entry.colors.length) await db.insert(t.vehicleColors).values(entry.colors.map((c) => ({ ...c, tenantId: tenant!.id, vehicleId: veh!.id })));
    }
  }
  return { seeded: true };
}
