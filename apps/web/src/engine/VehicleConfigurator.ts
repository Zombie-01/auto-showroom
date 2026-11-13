import * as THREE from 'three';
import type { VehicleManifest } from '@showroom/shared';
import type { VehicleRegistry } from './registry';
import type { MaterialChoice } from './store';
import { damp } from './timeline';

type Mat = THREE.MeshStandardMaterial & Partial<Pick<THREE.MeshPhysicalMaterial, 'clearcoat'>>;
interface TintUniforms { uTint: { value: THREE.Color }; uTintOn: { value: number }; uAvgLum: { value: number } }
const target = new THREE.Color();

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** Average linear luminance of a texture (sampled at 32×32), used as the recolour reference. */
function averageLuminance(tex: THREE.Texture): number {
  try {
    const img = tex.image as CanvasImageSource & { width: number; height: number };
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 128) continue;
      sum += 0.2126 * toLinear(d[i]! / 255) + 0.7152 * toLinear(d[i + 1]! / 255) + 0.0722 * toLinear(d[i + 2]! / 255);
      n++;
    }
    return n ? Math.max(sum / n, 0.002) : 0.18;
  } catch {
    return 0.18;
  }
}

/**
 * Textured surfaces (leather, plastics) are recoloured in the shader: each pixel's luminance relative
 * to the texture average is multiplied by the target colour. Grain, stitching and baked shading
 * survive, so a beige or brown interior still reads as leather — not flat paint.
 */
function tintUniforms(m: Mat): TintUniforms {
  if (m.userData.tint) return m.userData.tint as TintUniforms;
  const u: TintUniforms = { uTint: { value: new THREE.Color(1, 1, 1) }, uTintOn: { value: 0 }, uAvgLum: { value: averageLuminance(m.map!) } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = 'uniform vec3 uTint;\nuniform float uTintOn;\nuniform float uAvgLum;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        if ( uTintOn > 0.5 ) {
          float lum = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
          // Bright pixels in a shared atlas are chrome / white trim — leave them as authored.
          float keep = smoothstep( uAvgLum * 1.6, uAvgLum * 3.0, lum );
          vec3 tinted = uTint * clamp( lum / uAvgLum, 0.0, 1.8 );
          sampledDiffuseColor.rgb = mix( tinted, sampledDiffuseColor.rgb, keep );
        }
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  m.customProgramCacheKey = () => 'showroom-tint';
  m.needsUpdate = true;
  m.userData.tint = u;
  return u;
}

/**
 * Moves every material in each configurable group toward its chosen finish. Groups are
 * independent (body ≠ roof ≠ wheels ≠ seats…) — the asset must name materials per group.
 * Returns true while still transitioning.
 */
export function applyMaterialGroups(registry: VehicleRegistry, manifest: VehicleManifest, choices: Record<string, MaterialChoice>, dt: number, instant: boolean): boolean {
  const k = instant ? 1 : damp(9, dt);
  let moving = false;
  for (const group of manifest.materialGroups) {
    const chosen = choices[group.id];
    const c = chosen ?? group.default;
    target.set(c.hex);
    for (const name of group.materials) {
      for (const m of (registry.materialsByName.get(name) ?? []) as Mat[]) {
        const tracked = m.map ? tintUniforms(m).uTint.value : m.color;
        if (m.map) {
          const u = tintUniforms(m);
          // Asset default = original texture colours; any choice = recoloured texture.
          if (!chosen) { u.uTintOn.value = 0; u.uTint.value.set(1, 1, 1); }
          else {
            if (u.uTintOn.value === 0) { u.uTintOn.value = 1; u.uTint.value.copy(target); }
            u.uTint.value.lerp(target, k);
          }
        } else {
          m.color.lerp(target, k);
        }
        m.metalness += (c.metalness - m.metalness) * k;
        m.roughness += (c.roughness - m.roughness) * k;
        if (m.clearcoat !== undefined) m.clearcoat += (c.clearcoat - m.clearcoat) * k;
        if (chosen || !m.map) {
          if (Math.abs(tracked.r - target.r) + Math.abs(tracked.g - target.g) + Math.abs(tracked.b - target.b) > 0.002) moving = true;
        }
      }
    }
  }
  return moving;
}

/** Shows exactly the nodes of the active options of each switch (wheel designs, accessories). */
export function applySwitches(registry: VehicleRegistry, manifest: VehicleManifest, active: Record<string, string[]>) {
  for (const sw of manifest.switches) {
    const on = active[sw.id] ?? sw.default;
    for (const opt of sw.options) {
      const visible = on.includes(opt.id);
      for (const n of opt.nodes) { const o = registry.nodesByName.get(n); if (o) o.visible = visible; }
    }
  }
}
