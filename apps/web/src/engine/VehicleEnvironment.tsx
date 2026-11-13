import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import type { Quality } from './store';

/**
 * Procedural studio environment — softbox Lightformers rendered into a cube map, so reflections
 * look premium without downloading an HDR file. Swap for <Environment files="…hdr|.ktx2"> when a
 * licensed showroom HDRI is available.
 */
export function VehicleEnvironment({ quality, background = '#0a0a0b' }: { quality: Quality; background?: string }) {
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 9, 24]} />
      <Environment resolution={quality === 'low' ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[8, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[8, 1.4, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffe9cc" position={[0, 2, -8]} scale={4} />
        <Lightformer form="rect" intensity={0.4} color="#9fb4ff" position={[0, 0.5, 8]} scale={[12, 1, 1]} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#0c0c0e" roughness={0.9} metalness={0.05} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} scale={12} blur={2.4} far={2.5} opacity={0.75} resolution={quality === 'high' ? 1024 : 256} frames={quality === 'high' ? Infinity : 1} />
    </>
  );
}
