/**
 * Photo-realistic film preview on a masked region of a photo.
 *
 * Model (per pixel, linear light):
 *   Y      = luminance of the original pixel
 *   Yref   = median luminance of the region ≈ "the paint colour under neutral light"
 *   s      = Y / Yref
 *   diffuse   = target · min(s, 1)^shade          (form shading, darker where the panel turns away)
 *   specular  = max(Y − Yref, 0) · spec           (reflections / highlights, added on top as white light)
 *
 * The finish controls how much of the original lighting survives: gloss keeps all reflections,
 * satin softens them, matte nearly removes them and flattens the shading. Clear PPF keeps the
 * original paint and only adds a little depth; matte (stealth) PPF suppresses the reflections.
 *
 * Limitation: reflections that the original paint did not show (e.g. a white car photographed in
 * flat light, previewed in gloss black) cannot be invented — the preview is honest, not generative.
 */

export type Finish = 'gloss' | 'satin' | 'matte' | 'metallic';
export type FilmEffect =
  | { kind: 'wrap'; color: string; finish: Finish }
  | { kind: 'ppf'; finish: 'gloss' | 'matte' };

/** Paint up to KNEE × the median brightness is treated as lit paint; only light above it is a reflection. */
const KNEE = 1.35;

const FINISH: Record<Finish, { shade: number; spec: number; flake: number; tintSpec: number }> = {
  gloss: { shade: 1, spec: 1, flake: 0, tintSpec: 0 },
  satin: { shade: 0.85, spec: 0.38, flake: 0, tintSpec: 0.15 },
  matte: { shade: 0.62, spec: 0.08, flake: 0, tintSpec: 0.3 },
  metallic: { shade: 1.08, spec: 0.9, flake: 0.07, tintSpec: 0.45 },
};

// sRGB <-> linear lookup tables.
const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LUT_SIZE = 4096;
const TO_SRGB = new Uint8ClampedArray(LUT_SIZE + 1);
for (let i = 0; i <= LUT_SIZE; i++) {
  const c = i / LUT_SIZE;
  TO_SRGB[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
}
const enc = (v: number) => TO_SRGB[v <= 0 ? 0 : v >= 1 ? LUT_SIZE : (v * LUT_SIZE + 0.5) | 0]!;

export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [TO_LIN[(n >> 16) & 255]!, TO_LIN[(n >> 8) & 255]!, TO_LIN[n & 255]!];
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Median linear luminance of pixels whose mask alpha ≥ 0.5 (histogram over 8-bit luma). */
export function referenceLuminance(src: Uint8ClampedArray, alpha: Float32Array): number {
  const hist = new Uint32Array(1024);
  let n = 0;
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    if (alpha[i]! < 0.5) continue;
    const y = luminance(TO_LIN[src[p]!]!, TO_LIN[src[p + 1]!]!, TO_LIN[src[p + 2]!]!);
    hist[Math.min(1023, (y * 1023) | 0)]!++;
    n++;
  }
  if (n === 0) return 0.18;
  let acc = 0;
  for (let b = 0; b < 1024; b++) {
    acc += hist[b]!;
    if (acc >= n / 2) return Math.max(0.01, (b + 0.5) / 1023);
  }
  return 0.18;
}

/** Cheap deterministic per-pixel noise in [-1, 1] for metallic flake. */
const hash = (i: number) => {
  let x = (i * 374761393) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (((x ^ (x >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
};

/**
 * Apply `effect` to `dst` inside `alpha` (0..1 per pixel), reading lighting from `src`.
 * `src` and `dst` are RGBA buffers of the same size; `dst` may already contain other regions.
 */
export function applyFilm(src: Uint8ClampedArray, dst: Uint8ClampedArray, alpha: Float32Array, effect: FilmEffect) {
  const yRef = referenceLuminance(src, alpha);

  if (effect.kind === 'ppf') {
    const matte = effect.finish === 'matte';
    for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
      const a = alpha[i]!;
      if (a <= 0) continue;
      const r = TO_LIN[src[p]!]!, g = TO_LIN[src[p + 1]!]!, b = TO_LIN[src[p + 2]!]!;
      const y = luminance(r, g, b) || 1e-6;
      const s = y / yRef;
      let k: number, sat: number;
      if (matte) {
        // Stealth PPF: highlights collapse to a soft sheen, slight haze lifts the blacks.
        const s2 = s > KNEE ? KNEE + (s - KNEE) * 0.18 : s ** 0.8;
        k = (s2 * yRef + 0.012) / y;
        if (s > KNEE) k = Math.min(k, 1);
        sat = 0.9;
      } else {
        // Clear gloss PPF: a touch more depth and saturation (fresh clear-coat look).
        k = s > KNEE ? 1.04 : s ** 0.08 * 0.985;
        sat = 1.06;
      }
      const yk = y * k;
      const nr = yk + (r * k - yk) * sat, ng = yk + (g * k - yk) * sat, nb = yk + (b * k - yk) * sat;
      blend(dst, p, enc(nr), enc(ng), enc(nb), a);
    }
    return;
  }

  const f = FINISH[effect.finish];
  const [tr, tg, tb] = hexToLinear(effect.color);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    const a = alpha[i]!;
    if (a <= 0) continue;
    const y = luminance(TO_LIN[src[p]!]!, TO_LIN[src[p + 1]!]!, TO_LIN[src[p + 2]!]!);
    const s = y / yRef;
    let d = Math.min(s, KNEE) ** f.shade;
    if (f.flake) d *= 1 + f.flake * hash(i);
    const h = Math.max(y - yRef * KNEE, 0) * f.spec;
    // Highlights are white light, optionally tinted by the film (satin/matte/metallic).
    const hr = h * (1 - f.tintSpec + f.tintSpec * tr * 3);
    const hg = h * (1 - f.tintSpec + f.tintSpec * tg * 3);
    const hb = h * (1 - f.tintSpec + f.tintSpec * tb * 3);
    blend(dst, p, enc(tr * d + hr), enc(tg * d + hg), enc(tb * d + hb), a);
  }
}

function blend(dst: Uint8ClampedArray, p: number, r: number, g: number, b: number, a: number) {
  if (a >= 1) {
    dst[p] = r; dst[p + 1] = g; dst[p + 2] = b;
  } else {
    dst[p] = dst[p]! + (r - dst[p]!) * a;
    dst[p + 1] = dst[p + 1]! + (g - dst[p + 1]!) * a;
    dst[p + 2] = dst[p + 2]! + (b - dst[p + 2]!) * a;
  }
}

// ---------------------------------------------------------------------------------------------
// Paint detection: an AI mask of "the car" also contains glass, tyres, lights and badges.
// Film only goes on paint, so fade out pixels that are much darker than the paint (glass, rubber)
// or clearly a different hue (tail lights, indicators). Rough but robust on light/coloured cars;
// on very dark cars glass and paint look alike, so only the hue test is used there.

const toOklabAB = (r: number, g: number, b: number): [number, number, number] => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Per-pixel 0..1 "this is paint" weight inside the mask (unsmoothed; blur before use). */
export function paintWeights(src: Uint8ClampedArray, alpha: Float32Array): Float32Array {
  const yRef = referenceLuminance(src, alpha);
  // Reference hue: mean Oklab a/b of mid-tone pixels (likely clean paint).
  let sa = 0, sb = 0, n = 0;
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    if (alpha[i]! < 0.5) continue;
    const r = TO_LIN[src[p]!]!, g = TO_LIN[src[p + 1]!]!, b = TO_LIN[src[p + 2]!]!;
    const s = luminance(r, g, b) / yRef;
    if (s < 0.7 || s > 1.4) continue;
    const [, a, bb] = toOklabAB(r, g, b);
    sa += a; sb += bb; n++;
  }
  const ra = n ? sa / n : 0, rb = n ? sb / n : 0;
  const useLuma = yRef > 0.06; // dark paint: glass and paint are indistinguishable by brightness
  const w = new Float32Array(alpha.length);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    if (alpha[i]! <= 0) continue;
    const r = TO_LIN[src[p]!]!, g = TO_LIN[src[p + 1]!]!, b = TO_LIN[src[p + 2]!]!;
    const y = luminance(r, g, b);
    const [L, a, bb] = toOklabAB(r, g, b);
    // Hue distance only matters where there is enough light to see colour.
    const dist = Math.hypot(a - ra, bb - rb) * smooth(0.15, 0.35, L);
    let v = 1 - smooth(0.07, 0.13, dist);
    if (useLuma) v *= smooth(0.12, 0.28, y / yRef);
    w[i] = v;
  }
  return w;
}
