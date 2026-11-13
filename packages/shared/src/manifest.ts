import { z } from 'zod';
import { VehicleSystem } from './vehicle';

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

/** demonstration: generated stand-ins · evaluation: third-party model not cleared for commercial use · production: licensed. */
export const AssetStatus = z.enum(['demonstration', 'evaluation', 'production']);

export const SystemAsset = z.object({
  /** Path relative to the manifest file, or absolute URL (CDN). */
  url: z.string().min(1),
  draco: z.boolean().default(true),
  ktx2: z.boolean().default(false),
  /** Optional lower-detail file used on low-quality devices. */
  lodUrl: z.string().optional(),
  bytes: z.number().int().optional(),
});

export const MaterialGroup = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** glTF material names belonging to this configurable group. */
  materials: z.array(z.string().min(1)).min(1),
  surface: z.enum(['exterior', 'interior']),
  default: z.object({
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    metalness: z.number().min(0).max(1),
    roughness: z.number().min(0).max(1),
    clearcoat: z.number().min(0).max(1).default(0),
  }),
});
export type MaterialGroup = z.infer<typeof MaterialGroup>;

/** Visibility switches: wheel designs, accessories. Each option lists glTF nodes it shows. */
export const NodeSwitch = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['exclusive', 'toggle']),
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    nodes: z.array(z.string()),
    availability: z.enum(['factory-verified', 'dealer-option', 'demonstration']).default('demonstration'),
  })).min(1),
  default: z.array(z.string()),
});
export type NodeSwitch = z.infer<typeof NodeSwitch>;

export const ComponentMapping = z.object({
  /** Matches ComponentInfo.id in the vehicle data. */
  id: z.string().min(1),
  system: VehicleSystem,
  nodes: z.array(z.string().min(1)).min(1),
  explode: z.object({
    /** Translation in metres (vehicle space, +X forward, +Y up, +Z right) at full explosion. */
    offset: Vec3,
    /** Euler rotation in radians at full explosion. */
    rotation: Vec3.default([0, 0, 0]),
    /** 0..0.9 — fraction of the system's explode progress before this part starts moving. */
    delay: z.number().min(0).max(0.9).default(0),
    /** Mirror the Z offset (and X/Y rotation) for nodes resting at z < 0 — for symmetric L/R parts. */
    mirror: z.boolean().default(false),
  }).optional(),
  /** Provenance / accuracy note shown in the info panel (e.g. "illustrative engine, not the V35A"). */
  note: z.string().max(400).optional(),
  /** Camera framing used when the component is focused from the info panel. */
  focus: z.object({ position: Vec3, target: Vec3 }).optional(),
});
export type ComponentMapping = z.infer<typeof ComponentMapping>;

const SystemNumbers = z.partialRecord(VehicleSystem, z.number().min(0).max(1));

export const Keyframe = z.object({
  /** Position on the story timeline. Section i spans [i, i+1). */
  at: z.number().min(0),
  camera: z.object({ position: Vec3, target: Vec3, fov: z.number().min(10).max(90).default(35) }),
  explode: SystemNumbers.default({}),
  opacity: SystemNumbers.default({}),
  /** Vehicle yaw in radians. */
  yaw: z.number().default(0),
});
export type Keyframe = z.infer<typeof Keyframe>;

export const StorySection = z.object({
  id: z.string().min(1),
  index: z.string(),
  title: z.string().min(1),
  kicker: z.string().default(''),
  body: z.string().default(''),
  /** Components of these systems are selectable while this section is active. */
  interactiveSystems: z.array(VehicleSystem).default([]),
  /** Systems whose assets must be loaded before reaching this section. */
  requires: z.array(VehicleSystem).default([]),
});
export type StorySection = z.infer<typeof StorySection>;

export const VehicleManifest = z.object({
  schemaVersion: z.literal(1),
  vehicleSlug: z.string(),
  assetStatus: AssetStatus,
  /** Mandatory honesty line rendered in the UI whenever assetStatus is not "production". */
  disclaimer: z.string().min(1),
  units: z.literal('meters'),
  assets: z.partialRecord(VehicleSystem, SystemAsset),
  materialGroups: z.array(MaterialGroup).default([]),
  switches: z.array(NodeSwitch).default([]),
  components: z.array(ComponentMapping).default([]),
  story: z.object({
    sections: z.array(StorySection).min(1),
    keyframes: z.array(Keyframe).min(2),
  }),
  hero: z.object({ position: Vec3, target: Vec3, fov: z.number().default(30) }),
  configurator: z.object({ position: Vec3, target: Vec3, fov: z.number().default(32) }),
  /** Named camera presets, e.g. "interior" for the configurator's cabin view. */
  cameras: z.record(z.string(), z.object({ position: Vec3, target: Vec3, fov: z.number().default(35) })).default({}),
  /** Optional cabin volume. While the camera is inside it, overhead lights are dimmed (cheap occlusion). */
  cabin: z.object({ min: Vec3, max: Vec3 }).optional(),
  credits: z.array(z.string()).default([]),
});
export type VehicleManifest = z.infer<typeof VehicleManifest>;

/** Resolve an asset URL relative to the manifest URL. */
export function resolveAssetUrl(manifestUrl: string, assetUrl: string): string {
  if (/^(https?:)?\/\//.test(assetUrl) || assetUrl.startsWith('/')) return assetUrl;
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
  return base + assetUrl;
}

/** Validate a manifest and cross-check internal references. Returns human-readable problems. */
export function lintManifest(m: VehicleManifest): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of m.components) {
    if (ids.has(c.id)) problems.push(`duplicate component id "${c.id}"`);
    ids.add(c.id);
    if (!m.assets[c.system]) problems.push(`component "${c.id}" uses system "${c.system}" with no asset`);
  }
  const kf = m.story.keyframes;
  for (let i = 1; i < kf.length; i++) {
    if (kf[i]!.at <= kf[i - 1]!.at) problems.push(`keyframes must be strictly increasing (index ${i})`);
  }
  const last = kf[kf.length - 1]!.at;
  if (last > m.story.sections.length) problems.push(`last keyframe at ${last} exceeds section count ${m.story.sections.length}`);
  for (const s of m.switches) {
    for (const d of s.default) if (!s.options.some((o) => o.id === d)) problems.push(`switch "${s.id}" default "${d}" is not an option`);
  }
  return problems;
}
