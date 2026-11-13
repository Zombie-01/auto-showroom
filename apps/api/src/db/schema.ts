import { sql } from 'drizzle-orm';
import { bigserial, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Branding, ComponentInfo, Configuration, Contact, SpecSheet } from '@showroom/shared';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const tenantId = () => uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' });
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
/** numeric → JS number at the boundary (prices are display amounts, not ledger values). */
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

export const tenants = pgTable('tenants', {
  id: id(),
  slug: text('slug').notNull().unique(),
  branding: jsonb('branding').$type<Branding>().notNull(),
  contact: jsonb('contact').$type<Contact>().notNull(),
  createdAt: created(),
});

export const tenantDomains = pgTable('tenant_domains', {
  id: id(),
  tenantId: tenantId(),
  hostname: text('hostname').notNull().unique(),
  createdAt: created(),
});

export const dealerUsers = pgTable('dealer_users', {
  id: id(),
  tenantId: tenantId(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'staff'] }).notNull().default('staff'),
  createdAt: created(),
});

export const sessions = pgTable('sessions', {
  /** sha256(token) — the raw token only ever lives in the cookie. */
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => dealerUsers.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
});

export const vehicles = pgTable('vehicles', {
  id: id(),
  tenantId: tenantId(),
  slug: text('slug').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  generation: text('generation'),
  year: integer('year').notNull(),
  tagline: text('tagline').notNull().default(''),
  description: text('description').notNull().default(''),
  manifestUrl: text('manifest_url'),
  posterUrl: text('poster_url'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  sortOrder: integer('sort_order').notNull().default(0),
  specifications: jsonb('specifications').$type<SpecSheet>().notNull().default({}),
  components: jsonb('components').$type<ComponentInfo[]>().notNull().default([]),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('vehicles_tenant_slug').on(t.tenantId, t.slug)]);

export const vehicleVariants = pgTable('vehicle_variants', {
  id: id(),
  tenantId: tenantId(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  engine: text('engine').notNull().default(''),
  transmission: text('transmission').notNull().default(''),
  drivetrain: text('drivetrain').notNull().default(''),
  price: money('price'),
  currency: text('currency').notNull().default('MNT'),
  specOverrides: jsonb('spec_overrides').$type<SpecSheet>().notNull().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('variants_tenant_vehicle').on(t.tenantId, t.vehicleId)]);

export const vehicleColors = pgTable('vehicle_colors', {
  id: id(),
  tenantId: tenantId(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  group: text('group').notNull(),
  name: text('name').notNull(),
  hex: text('hex').notNull(),
  finish: jsonb('finish').$type<{ metalness: number; roughness: number; clearcoat: number; members?: Record<string, string> }>().notNull(),
  availability: text('availability', { enum: ['factory-verified', 'dealer-option', 'demonstration'] }).notNull().default('demonstration'),
  priceDelta: money('price_delta'),
  variantIds: jsonb('variant_ids').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('colors_tenant_vehicle').on(t.tenantId, t.vehicleId)]);

export const inventoryItems = pgTable('inventory_items', {
  id: id(),
  tenantId: tenantId(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => vehicleVariants.id, { onDelete: 'set null' }),
  colorName: text('color_name').notNull().default(''),
  vin: text('vin'),
  status: text('status', { enum: ['in_stock', 'incoming', 'reserved', 'sold'] }).notNull().default('in_stock'),
  quantity: integer('quantity').notNull().default(1),
  notes: text('notes').notNull().default(''),
  createdAt: created(),
}, (t) => [index('inventory_tenant').on(t.tenantId)]);

export const leads = pgTable('leads', {
  id: id(),
  tenantId: tenantId(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['quote', 'contact', 'test_drive'] }).notNull(),
  status: text('status', { enum: ['new', 'contacted', 'qualified', 'won', 'lost'] }).notNull().default('new'),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  preferredContact: text('preferred_contact').notNull().default('phone'),
  message: text('message'),
  configuration: jsonb('configuration').$type<Configuration>(),
  /** Human-readable snapshot of the configuration at submission time. */
  summary: jsonb('summary').$type<{ label: string; value: string }[]>().notNull().default([]),
  estimatedPrice: money('estimated_price'),
  currency: text('currency'),
  notes: text('notes').notNull().default(''),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('leads_tenant_created').on(t.tenantId, t.createdAt)]);

export const savedConfigurations = pgTable('saved_configurations', {
  id: text('id').primaryKey(),
  tenantId: tenantId(),
  vehicleSlug: text('vehicle_slug').notNull(),
  configuration: jsonb('configuration').$type<Configuration>().notNull(),
  createdAt: created(),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: tenantId(),
  type: text('type').notNull(),
  vehicleSlug: text('vehicle_slug'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
}, (t) => [index('events_tenant_created').on(t.tenantId, t.createdAt)]);
