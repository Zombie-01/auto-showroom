/** Mask helpers. Masks are Uint8 (0/255) at image resolution; alpha masks are Float32 0..1. */

/** Soft edge: separable box blur (two passes ≈ tent filter) so film edges don't look cut out. */
export function featherMask(mask: Uint8Array, width: number, height: number, radius = 1): Float32Array {
  return blurFloat(Float32Array.from(mask, (v) => v / 255), width, height, radius);
}

/** In-place-safe soft blur of a 0..1 float map (two separable box passes). */
export function blurFloat(a: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return a;
  const out = Float32Array.from(a);
  const tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    boxH(out, tmp, width, height, radius);
    boxV(tmp, out, width, height, radius);
  }
  return out;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[row + Math.min(w - 1, Math.max(0, x + k))]!;
      dst[row + x] = s / n;
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
      dst[y * w + x] = s / n;
    }
  }
}

/** Rasterise a closed polygon (normalised 0..1 coordinates) into a 0/255 mask (even-odd rule). */
export function polygonMask(points: { x: number; y: number }[], width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  if (points.length < 3) return out;
  const px = points.map((p) => p.x * width);
  const py = points.map((p) => p.y * height);
  const xs: number[] = [];
  for (let y = 0; y < height; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = px.length - 1; i < px.length; j = i++) {
      const yi = py[i]!, yj = py[j]!;
      if ((yi > cy) !== (yj > cy)) xs.push(px[i]! + ((cy - yi) / (yj - yi)) * (px[j]! - px[i]!));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k]! - 0.5)), x1 = Math.min(width - 1, Math.floor(xs[k + 1]! - 0.5));
      for (let x = x0; x <= x1; x++) out[y * width + x] = 255;
    }
  }
  return out;
}

/** Fraction of the image covered by the mask (used for a rough size sanity check in the UI). */
export const coverage = (mask: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n / mask.length;
};
