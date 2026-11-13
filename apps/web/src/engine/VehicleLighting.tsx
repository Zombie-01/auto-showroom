import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useEngineContext } from './context';
import type { Quality } from './store';
import { damp } from './timeline';

/**
 * Key / fill / rim studio rig. Real-time shadows only on high quality. Without shadow maps the
 * overhead lights would shine straight through the roof, so they dim while the camera is inside
 * the manifest's cabin volume.
 */
export function VehicleLighting({ quality }: { quality: Quality }) {
  const { registry } = useEngineContext();
  const key = useRef<THREE.DirectionalLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const level = useRef(1);

  useFrame(({ camera }, dt) => {
    const cabin = registry.manifest.cabin;
    let inside = false;
    if (cabin) {
      const p = camera.position;
      inside = p.x > cabin.min[0] && p.x < cabin.max[0] && p.y > cabin.min[1] && p.y < cabin.max[1] && p.z > cabin.min[2] && p.z < cabin.max[2];
    }
    level.current += ((inside ? 0.45 : 1) - level.current) * damp(4, Math.min(dt, 0.1));
    if (key.current) key.current.intensity = 1.6 * level.current;
    if (spot.current) spot.current.intensity = 18 * level.current;
    // Soft fill inside the cabin so leather and trim colours read correctly.
    if (amb.current) amb.current.intensity = 0.15 + (1 - level.current) * 1.1;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.15} />
      <directionalLight
        ref={key}
        position={[5, 8, 4]}
        intensity={1.6}
        castShadow={quality === 'high'}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-6, 3, -5]} intensity={0.7} color="#cdd8ff" />
      <spotLight ref={spot} position={[0, 7, 0]} angle={0.7} penumbra={1} intensity={18} distance={14} color="#fff6ea" />
    </>
  );
}
