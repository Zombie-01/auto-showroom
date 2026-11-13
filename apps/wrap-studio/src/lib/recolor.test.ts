import { describe, expect, it } from 'vitest';
import { applyFilm, paintWeights, referenceLuminance } from './recolor';
import { polygonMask, featherMask } from './mask';

const px = (rgb: [number, number, number][]) => Uint8ClampedArray.from(rgb.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('recolor', () => {
  it('leaves pixels outside the mask untouched', () => {
    const src = px([[200, 10, 10], [200, 10, 10]]);
    const dst = new Uint8ClampedArray(src);
    applyFilm(src, dst, Float32Array.from([1, 0]), { kind: 'wrap', color: '#0000ff', finish: 'gloss' });
    expect([...dst.slice(4, 8)]).toEqual([200, 10, 10, 255]);
    expect(dst[2]).toBeGreaterThan(dst[0]!);
  });

  it('maps the median paint tone to the film colour and keeps shading order', () => {
    const src = px([[60, 60, 60], [120, 120, 120], [120, 120, 120], [250, 250, 250]]);
    const dst = new Uint8ClampedArray(src);
    applyFilm(src, dst, new Float32Array(4).fill(1), { kind: 'wrap', color: '#b3121b', finish: 'gloss' });
    expect([dst[4], dst[5], dst[6]]).toEqual([179, 18, 27]); // median pixel = exact film colour
    expect(dst[0]!).toBeLessThan(dst[4]!); // shadow stays darker
    expect(dst[13]!).toBeGreaterThan(dst[5]!); // highlight adds white light
  });

  it('matte suppresses highlights compared with gloss', () => {
    const src = px([[120, 120, 120], [120, 120, 120], [250, 250, 250]]);
    const gloss = new Uint8ClampedArray(src), matte = new Uint8ClampedArray(src);
    const a = new Float32Array(3).fill(1);
    applyFilm(src, gloss, a, { kind: 'wrap', color: '#1a1a1c', finish: 'gloss' });
    applyFilm(src, matte, a, { kind: 'wrap', color: '#1a1a1c', finish: 'matte' });
    expect(matte[8]!).toBeLessThan(gloss[8]! - 60);
  });

  it('matte PPF keeps the paint colour but removes reflections', () => {
    const src = px([[30, 60, 160], [30, 60, 160], [240, 240, 250]]);
    const dst = new Uint8ClampedArray(src);
    applyFilm(src, dst, new Float32Array(3).fill(1), { kind: 'ppf', finish: 'matte' });
    expect(dst[2]!).toBeGreaterThan(dst[0]!); // still blue
    expect(dst[8]!).toBeLessThan(200); // highlight knocked down
  });

  it('reference luminance ignores unmasked pixels', () => {
    const src = px([[255, 255, 255], [0, 0, 0]]);
    expect(referenceLuminance(src, Float32Array.from([0, 1]))).toBeLessThanOrEqual(0.01); // floor avoids divide-by-zero on pure black
  });
});

describe('paint detection', () => {
  it('keeps white paint, drops tyre/glass and a red tail light', () => {
    const src = px([[230, 230, 228], [235, 235, 233], [225, 225, 224], [20, 20, 22], [200, 20, 25]]);
    const w = paintWeights(src, new Float32Array(5).fill(1));
    expect(w[0]).toBeCloseTo(1); expect(w[1]).toBeCloseTo(1);
    expect(w[3]!).toBeLessThan(0.05); // tyre
    expect(w[4]!).toBeLessThan(0.05); // tail light
  });
  it('on a black car keeps dark paint (no brightness test)', () => {
    const src = px([[18, 18, 20], [22, 22, 24], [8, 8, 9], [60, 60, 62]]);
    const w = paintWeights(src, new Float32Array(4).fill(1));
    expect(Math.min(...w)).toBeGreaterThan(0.9);
  });
});

describe('mask', () => {
  it('rasterises a polygon', () => {
    const m = polygonMask([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 4, 4);
    expect(m.every((v) => v === 255)).toBe(true);
    const half = polygonMask([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }], 4, 4);
    expect([...half.slice(0, 4)]).toEqual([255, 255, 0, 0]);
  });
  it('feathers edges only', () => {
    const m = new Uint8Array(49); for (let y = 0; y < 7; y++) for (let x = 0; x < 3; x++) m[y * 7 + x] = 255;
    const a = featherMask(m, 7, 7, 1); // two box passes of radius 1 → 2px soft edge
    expect(a[0]).toBeCloseTo(1); expect(a[2]!).toBeGreaterThan(0.3); expect(a[2]!).toBeLessThan(1); expect(a[6]).toBe(0);
  });
});
