import type { ComponentInfo, SpecValue, VehicleSystem } from '@showroom/shared';

export const ref = (key: string, label: string, value: string, unit: string | undefined, source: string): SpecValue =>
  ({ key, label, value, unit, status: 'reference', source });
export const na = (key: string, label: string): SpecValue => ({ key, label, value: null, status: 'unavailable' });

const UNVERIFIED_MATERIAL = { value: null, status: 'unavailable' as const };

/**
 * Component copy describes what a part generally IS and DOES (engineering facts that hold for
 * any vehicle with that part). Vehicle-specific technical data goes in `technical` with a status.
 */
export const comp = (
  system: VehicleSystem, id: string, name: string, category: string, description: string, fn: string,
  technical: SpecValue[] = [], relatedSpecKeys: string[] = [],
): ComponentInfo => ({ id, system, name, category, description, function: fn, material: UNVERIFIED_MATERIAL, technical, relatedSpecKeys });
