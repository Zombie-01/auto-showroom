import { create } from 'zustand';
import type { VehicleManifest, VehicleSystem } from '@showroom/shared';
import type { Pose } from './timeline';

export type CameraMode = 'story' | 'orbit' | 'turntable';
export type Quality = 'high' | 'medium' | 'low';

/** A chosen finish. Textured materials keep their texture only for the asset default (no choice). */
export interface MaterialChoice { hex: string; metalness: number; roughness: number; clearcoat: number }

interface EngineState {
  manifest: VehicleManifest | null;
  manifestUrl: string | null;
  mode: CameraMode;
  quality: Quality;
  reducedMotion: boolean;
  /** Story timeline position in section units (section i spans [i, i+1)). */
  storyAt: number;
  sectionIndex: number;
  hovered: string | null;
  selected: string | null;
  /** Systems whose components respond to pointer input right now. */
  interactive: VehicleSystem[];
  /** Systems that should be mounted (their GLB requested). */
  requested: VehicleSystem[];
  loaded: VehicleSystem[];
  failed: Partial<Record<VehicleSystem, string>>;
  /** Static pose for orbit/turntable modes (explode/opacity), and camera preset. */
  staticPose: Pose | null;
  materials: Record<string, MaterialChoice>;
  switches: Record<string, string[]>;
  /** Registered by the canvas so the DOM can request a PNG. */
  capture: (() => string | null) | null;

  set: (p: Partial<EngineState>) => void;
  request: (systems: VehicleSystem[]) => void;
  markLoaded: (s: VehicleSystem) => void;
  markFailed: (s: VehicleSystem, msg: string) => void;
  reset: () => void;
}

const initial = {
  manifest: null, manifestUrl: null, mode: 'turntable' as CameraMode, quality: 'high' as Quality, reducedMotion: false,
  storyAt: 0, sectionIndex: 0, hovered: null, selected: null, interactive: [] as VehicleSystem[],
  requested: ['exterior'] as VehicleSystem[], loaded: [] as VehicleSystem[], failed: {}, staticPose: null,
  materials: {}, switches: {}, capture: null,
};

export const useEngine = create<EngineState>((set) => ({
  ...initial,
  set: (p) => set(p),
  request: (systems) => set((s) => {
    const next = systems.filter((x) => !s.requested.includes(x));
    return next.length ? { requested: [...s.requested, ...next] } : s;
  }),
  markLoaded: (sys) => set((s) => (s.loaded.includes(sys) ? s : { loaded: [...s.loaded, sys] })),
  markFailed: (sys, msg) => set((s) => ({ failed: { ...s.failed, [sys]: msg } })),
  // Device settings (quality, reduced motion) survive a reset; everything vehicle-specific doesn't.
  reset: () => set((s) => ({ ...initial, quality: s.quality, reducedMotion: s.reducedMotion })),
}));

// Dev-only handle for debugging and browser tests. Stripped from production builds.
if (import.meta.env.DEV) (globalThis as unknown as { __engine: typeof useEngine }).__engine = useEngine;
