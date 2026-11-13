import type { VehicleRegistry } from './registry';
import type { SystemValues } from './timeline';
import { explodedTransform } from './explode';

/**
 * Applies the manifest-defined exploded state for every registered component. Pure function of
 * (rest transform, explode amount) — no accumulated state, so it is exactly reversible.
 */
export function applyExplodedView(registry: VehicleRegistry, explode: SystemValues) {
  for (const c of registry.components.values()) {
    const ex = c.mapping.explode;
    if (!ex) continue;
    const amount = explode[c.mapping.system] ?? 0;
    for (const n of c.nodes) {
      const t = explodedTransform(ex, n.rest, amount);
      n.object.position.set(t.position[0], t.position[1], t.position[2]);
      n.object.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
    }
  }
}

/** Fades whole systems (ghosting the body to reveal the engine, etc.). Skips work when unchanged. */
export function applySystemOpacity(registry: VehicleRegistry, opacity: SystemValues) {
  for (const [system, s] of registry.systems) {
    const o = Math.round((opacity[system] ?? 0) * 1000) / 1000;
    if (o === s.lastOpacity) continue;
    s.lastOpacity = o;
    s.root.visible = o > 0.005;
    for (const m of s.materials) {
      const transparent = m.baseTransparent || o < 0.999;
      if (m.material.transparent !== transparent) { m.material.transparent = transparent; m.material.needsUpdate = true; }
      m.material.opacity = m.baseOpacity * o;
      m.material.depthWrite = o > 0.6;
    }
  }
}
