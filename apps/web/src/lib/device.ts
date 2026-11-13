import type { Quality } from '../engine/store';

export type WebGLSupport = { ok: true; webgl2: boolean } | { ok: false; reason: string };

export function detectWebGL(): WebGLSupport {
  try {
    if (new URLSearchParams(location.search).has('nowebgl')) return { ok: false, reason: 'WebGL туршилтаар унтраасан (?nowebgl).' };
    const c = document.createElement('canvas');
    const gl2 = c.getContext('webgl2');
    if (gl2) { gl2.getExtension('WEBGL_lose_context')?.loseContext(); return { ok: true, webgl2: true }; }
    const gl = c.getContext('webgl');
    if (gl) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return { ok: true, webgl2: false }; }
    return { ok: false, reason: 'Энэ хөтөч эсвэл төхөөрөмж WebGL дэмжихгүй байна.' };
  } catch {
    return { ok: false, reason: 'WebGL эхлүүлж чадсангүй.' };
  }
}

/** Initial quality tier. PerformanceMonitor steps it down at runtime if frames drop. */
export function initialQuality(): Quality {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'low';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (coarse && (mem <= 3 || cores <= 4)) return 'low';
  if (coarse || mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}
