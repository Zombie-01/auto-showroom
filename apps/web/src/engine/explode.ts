import type { ComponentMapping, Vec3 } from '@showroom/shared';
import { ease } from './timeline';

/** Per-component progress given the system's explode amount and the component's stagger delay. */
export function componentProgress(amount: number, delay: number): number {
  if (delay <= 0) return ease(amount);
  return ease((amount - delay) / (1 - delay));
}

/**
 * Exploded transform for one node. `rest` is the node's authored position; mirrored parts on the
 * negative-Z side get their Z offset and X/Y rotations flipped so L/R pairs separate symmetrically.
 */
export function explodedTransform(
  explode: NonNullable<ComponentMapping['explode']>,
  rest: { position: Vec3; rotation: Vec3 },
  amount: number,
): { position: Vec3; rotation: Vec3 } {
  const p = componentProgress(amount, explode.delay);
  const flip = explode.mirror && rest.position[2] < 0 ? -1 : 1;
  const [ox, oy, oz] = explode.offset;
  const [rx, ry, rz] = explode.rotation;
  return {
    position: [rest.position[0] + ox * p, rest.position[1] + oy * p, rest.position[2] + oz * flip * p],
    rotation: [rest.rotation[0] + rx * flip * p, rest.rotation[1] + ry * flip * p, rest.rotation[2] + rz * p],
  };
}
