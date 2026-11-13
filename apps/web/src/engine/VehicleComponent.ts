import * as THREE from 'three';
import type { VehicleRegistry } from './registry';

const tmp = new THREE.Color();

/**
 * Component highlighting via emissive tint on the component's private material clones.
 * Selected parts pulse gently; hovered parts get a steady, lower tint.
 */
export function applyHighlight(registry: VehicleRegistry, selected: string | null, hovered: string | null, accent: THREE.Color, time: number, reducedMotion: boolean) {
  const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(time * 3.2);
  for (const [id, c] of registry.components) {
    const level = id === selected ? 0.55 * pulse : id === hovered ? 0.28 : 0;
    for (const m of c.materials) {
      const base = m.userData.baseEmissive as THREE.Color;
      const baseI = m.userData.baseEmissiveIntensity as number;
      if (level === 0) {
        if (m.userData.hl) { m.emissive.copy(base); m.emissiveIntensity = baseI; m.userData.hl = false; }
        continue;
      }
      tmp.copy(base).lerp(accent, Math.min(1, level * 1.6));
      m.emissive.copy(tmp);
      m.emissiveIntensity = Math.max(baseI, level);
      m.userData.hl = true;
    }
  }
}
