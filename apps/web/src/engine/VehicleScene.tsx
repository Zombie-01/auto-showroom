import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { VehicleManifest } from '@showroom/shared';
import { EngineContext } from './context';
import { VehicleRegistry } from './registry';
import { useEngine, type Quality } from './store';
import { sampleTimeline, type Pose } from './timeline';
import { VehicleCamera } from './VehicleCamera';
import { VehicleController } from './VehicleController';
import { VehicleEnvironment } from './VehicleEnvironment';
import { VehicleLighting } from './VehicleLighting';
import { VehicleModel } from './VehicleModel';

function CaptureRegistrar() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    useEngine.setState({ capture: () => { gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); } });
    if (import.meta.env.DEV) (globalThis as unknown as { __gl: unknown }).__gl = gl;
    return () => useEngine.setState({ capture: null });
  }, [gl, scene, camera]);
  return null;
}

const DPR: Record<Quality, [number, number]> = { high: [1, 2], medium: [1, 1.5], low: [0.75, 1] };

export interface VehicleSceneProps {
  manifest: VehicleManifest;
  className?: string;
  orbitLimits?: Parameters<typeof VehicleCamera>[0]['orbitLimits'];
  children?: ReactNode;
  label: string;
}

/**
 * The reusable 3D stage. Everything vehicle-specific arrives via the manifest; pages only set
 * the engine store (mode, story position, configuration).
 */
export function VehicleScene({ manifest, className, orbitLimits, children, label }: VehicleSceneProps) {
  const registry = useMemo(() => new VehicleRegistry(manifest), [manifest]);
  const quality = useEngine((s) => s.quality);
  const initialPose = useMemo<Pose>(() => {
    const s = useEngine.getState();
    if (s.mode === 'story') return sampleTimeline(manifest.story.keyframes, s.storyAt);
    return structuredClone(s.staticPose ?? sampleTimeline(manifest.story.keyframes, 0));
  }, [manifest]);
  const pose = useRef<Pose>(initialPose);

  return (
    <div className={className} role="img" aria-label={label}>
      <Canvas
        shadows={quality === 'high'}
        dpr={DPR[quality]}
        camera={{ position: initialPose.position, fov: initialPose.fov, near: 0.05, far: 60 }}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false, toneMapping: THREE.ACESFilmicToneMapping }}
        onPointerMissed={() => useEngine.setState({ selected: null })}
      >
        <PerformanceMonitor
          onDecline={() => { const q = useEngine.getState().quality; if (q !== 'low') useEngine.setState({ quality: q === 'high' ? 'medium' : 'low' }); }}
          flipflops={2}
        />
        <EngineContext.Provider value={{ registry, pose }}>
          <VehicleEnvironment quality={quality} />
          <VehicleLighting quality={quality} />
          <VehicleController />
          <VehicleCamera orbitLimits={orbitLimits} />
          <VehicleModel />
          <CaptureRegistrar />
          {children}
        </EngineContext.Provider>
      </Canvas>
    </div>
  );
}
