import { describe, expect, it } from 'vitest';
import { lintManifest, VehicleManifest } from '@showroom/shared';
import { componentProgress, explodedTransform } from './explode';
import { interpolateCamera, sampleTimeline } from './timeline';
import raw from '../../public/assets/vehicles/toyota/land-cruiser-300/demo.manifest.json';

const manifest = VehicleManifest.parse(raw);

describe('timeline', () => {
  const kfs = manifest.story.keyframes;
  it('is deterministic and reversible: the same position always yields the same pose', () => {
    const forward = [0, 0.3, 1.5, 2.4, 5.2].map((t) => sampleTimeline(kfs, t));
    const backward = [5.2, 2.4, 1.5, 0.3, 0].map((t) => sampleTimeline(kfs, t)).reverse();
    expect(backward).toEqual(forward);
  });
  it('hits keyframes exactly', () => {
    for (const k of kfs) {
      const p = sampleTimeline(kfs, k.at);
      expect(p.position[0]).toBeCloseTo(k.camera.position[0], 6);
      expect(p.explode.exterior).toBeCloseTo(k.explode.exterior ?? 0, 6);
    }
  });
  it('clamps beyond either end', () => {
    expect(sampleTimeline(kfs, -5)).toEqual(sampleTimeline(kfs, 0));
    expect(sampleTimeline(kfs, 99)).toEqual(sampleTimeline(kfs, kfs[kfs.length - 1]!.at));
  });
  it('orbits rather than cutting through the vehicle', () => {
    const a = { position: [5, 1, 0] as [number, number, number], target: [0, 1, 0] as [number, number, number], fov: 35 };
    const b = { position: [-5, 1, 0] as [number, number, number], target: [0, 1, 0] as [number, number, number], fov: 35 };
    const mid = interpolateCamera(a, b, 0.5);
    expect(Math.hypot(mid.position[0], mid.position[2])).toBeCloseTo(5, 5);
  });
  it('fully reassembles the vehicle at the end of the story', () => {
    const end = sampleTimeline(kfs, manifest.story.sections.length);
    expect(Object.values(end.explode).every((v) => v === 0)).toBe(true);
    expect(end.opacity.exterior).toBe(1);
  });
});

describe('exploded view', () => {
  it('rests at 0 and reaches the exact offset at 1', () => {
    const ex = { offset: [1, 2, 0.5] as [number, number, number], rotation: [0, 0, 0.3] as [number, number, number], delay: 0.2, mirror: true };
    const rest = { position: [1, 1, -0.8] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
    expect(explodedTransform(ex, rest, 0)).toEqual(rest);
    const full = explodedTransform(ex, rest, 1);
    expect(full.position).toEqual([2, 3, -1.3]); // mirrored on the -Z side
    expect(full.rotation[2]).toBeCloseTo(0.3);
  });
  it('respects stagger delay', () => {
    expect(componentProgress(0.2, 0.3)).toBe(0);
    expect(componentProgress(1, 0.3)).toBe(1);
  });
});

describe('demo manifest', () => {
  it('lints clean and is labelled as demonstration', () => {
    expect(lintManifest(manifest)).toEqual([]);
    expect(manifest.assetStatus).toBe('demonstration');
    expect(manifest.disclaimer.length).toBeGreaterThan(20);
  });
});
