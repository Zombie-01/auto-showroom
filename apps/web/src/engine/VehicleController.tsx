import { useFrame } from '@react-three/fiber';
import { VEHICLE_SYSTEMS } from '@showroom/shared';
import { useEngineContext } from './context';
import { useEngine } from './store';
import { damp, sampleTimeline, type Pose } from './timeline';

/**
 * Computes the target pose for the active mode and damps the shared pose toward it.
 *  - story:     pose sampled from the manifest timeline at the scroll-driven position
 *  - turntable: hero camera, slowly increasing yaw
 *  - orbit:     static explode/opacity; the camera is owned by OrbitControls
 */
export function VehicleController() {
  const { registry, pose } = useEngineContext();
  const manifest = registry.manifest;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { mode, storyAt, staticPose, reducedMotion } = useEngine.getState();
    let target: Pose;
    if (mode === 'story') target = sampleTimeline(manifest.story.keyframes, storyAt);
    else if (staticPose) target = staticPose;
    else target = pose.current;

    const p = pose.current;
    const k = reducedMotion ? 1 : damp(mode === 'story' ? 5 : 4, dt);
    for (let i = 0; i < 3; i++) {
      p.position[i] = p.position[i]! + (target.position[i]! - p.position[i]!) * k;
      p.target[i] = p.target[i]! + (target.target[i]! - p.target[i]!) * k;
    }
    p.fov += (target.fov - p.fov) * k;
    for (const s of VEHICLE_SYSTEMS) {
      p.explode[s] += (target.explode[s] - p.explode[s]) * k;
      p.opacity[s] += (target.opacity[s] - p.opacity[s]) * k;
      if (Math.abs(target.explode[s] - p.explode[s]) < 1e-4) p.explode[s] = target.explode[s];
      if (Math.abs(target.opacity[s] - p.opacity[s]) < 1e-4) p.opacity[s] = target.opacity[s];
    }
    if (mode === 'turntable') { if (!reducedMotion) p.yaw += dt * 0.12; }
    else p.yaw += (target.yaw - p.yaw) * k;
  }, -1);

  return null;
}
