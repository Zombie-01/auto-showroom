import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEngineContext } from './context';
import { useEngine } from './store';
import { damp } from './timeline';

const v = new THREE.Vector3();
/** Aspect the manifest cameras were composed for. */
const DESIGN_ASPECT = 16 / 10;

/**
 * Narrow (portrait) viewports keep most of the designed horizontal field of view by widening the
 * vertical FOV, so the subject stays framed on phones. Moving the camera back instead would break
 * interior shots that must stay inside the cabin.
 */
export function aspectFov(fov: number, aspect: number) {
  if (aspect >= DESIGN_ASPECT) return fov;
  const t = Math.tan((fov * Math.PI) / 360) * Math.pow(DESIGN_ASPECT / aspect, 0.75);
  return Math.min(95, (Math.atan(t) * 360) / Math.PI);
}

/**
 * Story / turntable: camera follows the damped pose.
 * Orbit: user-controlled; when the static preset changes, the camera glides to it, then hands control back.
 */
export function VehicleCamera({ orbitLimits }: { orbitLimits?: { minDistance?: number; maxDistance?: number; maxPolarAngle?: number } }) {
  const { pose } = useEngineContext();
  const mode = useEngine((s) => s.mode);
  const staticPose = useEngine((s) => s.staticPose);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useRef<OrbitControlsImpl>(null);
  const gliding = useRef(true);
  const userTouched = useRef(false);

  useEffect(() => { gliding.current = true; userTouched.current = false; }, [staticPose, mode]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = pose.current;
    if (mode !== 'orbit') {
      camera.position.set(p.position[0], p.position[1], p.position[2]);
      const fov = aspectFov(p.fov, camera.aspect);
      // Lens shift: on wide screens the story copy sits left, so frame the vehicle right of centre.
      const offset = mode === 'story' && camera.aspect > 1.2 ? -3.2 : 0;
      if (Math.abs(camera.fov - fov) > 0.01 || camera.filmOffset !== offset) { camera.fov = fov; camera.filmOffset = offset; camera.updateProjectionMatrix(); }
      camera.lookAt(p.target[0], p.target[1], p.target[2]);
      return;
    }
    const c = controls.current;
    if (!c || !staticPose || !gliding.current || userTouched.current) return;
    const { reducedMotion } = useEngine.getState();
    const k = reducedMotion ? 1 : damp(4.5, dt);
    camera.position.lerp(v.set(...staticPose.position), k);
    c.target.lerp(v.set(...staticPose.target), k);
    camera.fov += (aspectFov(staticPose.fov, camera.aspect) - camera.fov) * k;
    camera.filmOffset = 0;
    camera.updateProjectionMatrix();
    c.update();
    if (camera.position.distanceTo(v.set(...staticPose.position)) < 0.005) gliding.current = false;
  });

  if (mode !== 'orbit') return null;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      minDistance={orbitLimits?.minDistance ?? 0.4}
      maxDistance={orbitLimits?.maxDistance ?? 11}
      maxPolarAngle={orbitLimits?.maxPolarAngle ?? Math.PI * 0.49}
      onStart={() => { userTouched.current = true; }}
    />
  );
}
