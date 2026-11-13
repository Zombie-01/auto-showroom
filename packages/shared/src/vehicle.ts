import { z } from 'zod';

/**
 * Every piece of technical data carries a verification status.
 *
 * - verified:     confirmed by the dealer/importer against official manufacturer documentation
 *                 for the specific market, model year and trim.
 * - reference:    taken from a public manufacturer publication (source required) but not yet
 *                 confirmed for this dealer's market/trim. Shown with a "reference" marker.
 * - unavailable:  no trustworthy value. The UI shows "Not available" — never a guess.
 */
export const VerificationStatus = z.enum(['verified', 'reference', 'unavailable']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const SpecValue = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().nullable(),
  unit: z.string().optional(),
  status: VerificationStatus,
  source: z.string().optional(),
}).superRefine((s, ctx) => {
  if (s.status !== 'unavailable' && (s.value == null || s.value.trim() === '')) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Төлөв "Мэдээлэлгүй"-ээс бусад үед утга заавал' });
  if (s.status === 'unavailable' && s.value != null && s.value.trim() !== '') ctx.addIssue({ code: 'custom', path: ['status'], message: 'Утга оруулсан бол төлвийг "Лавлагаа" эсвэл "Баталгаажсан" болгоно уу' });
  if (s.status !== 'unavailable' && !s.source?.trim()) ctx.addIssue({ code: 'custom', path: ['source'], message: 'Лавлагаа ба баталгаажсан утгад эх сурвалж заавал' });
});
export type SpecValue = z.infer<typeof SpecValue>;

export const SPEC_CATEGORIES = ['engine', 'transmission', 'dimensions', 'capacity', 'performance', 'offroad', 'safety', 'comfort', 'multimedia', 'ownership'] as const;
export const SpecCategory = z.enum(SPEC_CATEGORIES);
export type SpecCategory = z.infer<typeof SpecCategory>;

export const SpecSheet = z.partialRecord(SpecCategory, z.array(SpecValue));
export type SpecSheet = z.infer<typeof SpecSheet>;

export const VEHICLE_SYSTEMS = ['exterior', 'engine', 'transmission', 'suspension', 'interior'] as const;
export const VehicleSystem = z.enum(VEHICLE_SYSTEMS);
export type VehicleSystem = z.infer<typeof VehicleSystem>;

/** Editorial / technical information for a component. 3D mapping lives in the manifest. */
export const ComponentInfo = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  system: VehicleSystem,
  category: z.string().min(1),
  description: z.string(),
  function: z.string(),
  material: z.object({ value: z.string().nullable(), status: VerificationStatus, source: z.string().optional() }),
  technical: z.array(SpecValue).default([]),
  relatedSpecKeys: z.array(z.string()).default([]),
});
export type ComponentInfo = z.infer<typeof ComponentInfo>;

export const VehicleStatus = z.enum(['draft', 'published']);

export const VehicleInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  generation: z.string().max(80).nullable().default(null),
  year: z.number().int().min(1950).max(2100),
  tagline: z.string().max(160).default(''),
  description: z.string().max(4000).default(''),
  manifestUrl: z.string().max(500).nullable().default(null),
  posterUrl: z.string().max(500).nullable().default(null),
  status: VehicleStatus.default('draft'),
  sortOrder: z.number().int().default(0),
  specifications: SpecSheet.default({}),
  components: z.array(ComponentInfo).default([]),
});
export type VehicleInput = z.infer<typeof VehicleInput>;

export const VariantInput = z.object({
  name: z.string().min(1).max(80),
  engine: z.string().max(120).default(''),
  transmission: z.string().max(120).default(''),
  drivetrain: z.string().max(120).default(''),
  /** Integer minor units are avoided on purpose: prices are dealer-entered whole amounts (MNT has no minor unit in practice). */
  price: z.number().nonnegative().nullable().default(null),
  currency: z.string().length(3).default('MNT'),
  specOverrides: SpecSheet.default({}),
  sortOrder: z.number().int().default(0),
});
export type VariantInput = z.infer<typeof VariantInput>;

/** Which configurable slot an option applies to. Must match a manifest material group or switch. */
export const OptionAvailability = z.enum(['factory-verified', 'dealer-option', 'demonstration']);
export type OptionAvailability = z.infer<typeof OptionAvailability>;

export const ColorInput = z.object({
  group: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  finish: z.object({
    metalness: z.number().min(0).max(1).default(0.6),
    roughness: z.number().min(0).max(1).default(0.35),
    clearcoat: z.number().min(0).max(1).default(1),
    /** Colour packages (group "interior_theme"): material group id → colour applied together. */
    members: z.record(z.string().max(40), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
  }).prefault({}),
  availability: OptionAvailability.default('demonstration'),
  priceDelta: z.number().nullable().default(null),
  variantIds: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});
export type ColorInput = z.infer<typeof ColorInput>;

export interface Vehicle extends VehicleInput { id: string; tenantId: string }
export interface Variant extends VariantInput { id: string; vehicleId: string }
export interface VehicleColor extends ColorInput { id: string; vehicleId: string }

export interface VehicleDetail extends Vehicle {
  variants: Variant[];
  colors: VehicleColor[];
}

/** Lowest configured variant price, or null when no price has been configured. */
export function startingPrice(variants: Pick<Variant, 'price' | 'currency'>[]): { amount: number; currency: string } | null {
  const priced = variants.filter((v): v is typeof v & { price: number } => v.price != null);
  if (priced.length === 0) return null;
  const min = priced.reduce((a, b) => (b.price < a.price ? b : a));
  return { amount: min.price, currency: min.currency };
}

/** Merge a variant's spec overrides on top of the base sheet (override by key, per category). */
export function mergeSpecs(base: SpecSheet, overrides: SpecSheet | undefined): SpecSheet {
  if (!overrides) return base;
  const out: SpecSheet = {};
  for (const cat of SPEC_CATEGORIES) {
    const b = base[cat] ?? [];
    const o = overrides[cat] ?? [];
    if (!b.length && !o.length) continue;
    const merged = b.map((s) => o.find((x) => x.key === s.key) ?? s);
    for (const x of o) if (!b.some((s) => s.key === x.key)) merged.push(x);
    out[cat] = merged;
  }
  return out;
}
