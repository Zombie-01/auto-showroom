import { VEHICLE_SYSTEMS, type Keyframe, type Vec3, type VehicleSystem } from '@showroom/shared';

export type SystemValues = Record<VehicleSystem, number>;
export interface Pose {
  position: Vec3;
  target: Vec3;
  fov: number;
  yaw: number;
  explode: SystemValues;
  opacity: SystemValues;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Smootherstep — zero velocity and acceleration at both ends, so holds feel deliberate. */
export const ease = (t: number) => { const x = clamp01(t); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function systems(partial: Partial<SystemValues> | undefined, fallback: number): SystemValues {
  const out = {} as SystemValues;
  for (const s of VEHICLE_SYSTEMS) out[s] = partial?.[s] ?? fallback;
  return out;
}

function toSpherical(p: Vec3, t: Vec3) {
  const dx = p[0] - t[0], dy = p[1] - t[1], dz = p[2] - t[2];
  const r = Math.hypot(dx, dy, dz);
  return { r, theta: Math.atan2(dx, dz), phi: Math.acos(Math.max(-1, Math.min(1, dy / (r || 1)))) };
}

/** Shortest signed angular difference b - a in (-π, π]. */
function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Interpolates the camera on a sphere around the (interpolated) target rather than in a straight
 * line, so moving between two views orbits the vehicle instead of cutting through it.
 */
export function interpolateCamera(a: Keyframe['camera'], b: Keyframe['camera'], t: number) {
  const target: Vec3 = [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)];
  const sa = toSpherical(a.position, a.target), sb = toSpherical(b.position, b.target);
  const r = lerp(sa.r, sb.r, t);
  const theta = sa.theta + angleDelta(sa.theta, sb.theta) * t;
  const phi = lerp(sa.phi, sb.phi, t);
  const position: Vec3 = [target[0] + r * Math.sin(phi) * Math.sin(theta), target[1] + r * Math.cos(phi), target[2] + r * Math.sin(phi) * Math.cos(theta)];
  return { position, target, fov: lerp(a.fov, b.fov, t) };
}

/**
 * Deterministic pose for a timeline position. The same input always yields the same pose, so
 * scrolling backwards exactly reverses every animation.
 */
export function sampleTimeline(keyframes: Keyframe[], at: number): Pose {
  if (keyframes.length === 0) throw new Error('timeline needs keyframes');
  const first = keyframes[0]!, last = keyframes[keyframes.length - 1]!;
  const fromKf = (k: Keyframe): Pose => ({ ...k.camera, yaw: k.yaw, explode: systems(k.explode, 0), opacity: systems(k.opacity, 0) });
  if (at <= first.at) return fromKf(first);
  if (at >= last.at) return fromKf(last);
  let i = 0;
  while (i < keyframes.length - 2 && keyframes[i + 1]!.at <= at) i++;
  const a = keyframes[i]!, b = keyframes[i + 1]!;
  const t = ease((at - a.at) / (b.at - a.at));
  const ea = systems(a.explode, 0), eb = systems(b.explode, 0), oa = systems(a.opacity, 0), ob = systems(b.opacity, 0);
  const explode = {} as SystemValues, opacity = {} as SystemValues;
  for (const s of VEHICLE_SYSTEMS) { explode[s] = lerp(ea[s], eb[s], t); opacity[s] = lerp(oa[s], ob[s], t); }
  return { ...interpolateCamera(a.camera, b.camera, t), yaw: lerp(a.yaw, b.yaw, t), explode, opacity };
}

/** Frame-rate independent exponential damping factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);
