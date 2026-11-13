import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveAssetUrl, type VehicleSystem } from '@showroom/shared';
import { useEngineContext } from './context';
import { configureGltfLoader } from './loaders';
import { VehicleRegistry } from './registry';
import { useEngine } from './store';
import { applyExplodedView, applySystemOpacity } from './VehicleExplodedView';
import { applyHighlight } from './VehicleComponent';
import { applyMaterialGroups, applySwitches } from './VehicleConfigurator';

class AssetBoundary extends Component<{ system: VehicleSystem; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) { useEngine.getState().markFailed(this.props.system, err.message || 'Failed to load'); }
  render() { return this.state.failed ? null : this.props.children; }
}

function SystemAsset({ system, url, onReady }: { system: VehicleSystem; url: string; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const { registry } = useEngineContext();
  const gltf = useLoader(GLTFLoader, url, configureGltfLoader(gl));
  // Private clone per mount: the loader cache is shared across pages.
  const root = useMemo(() => gltf.scene.clone(true), [gltf]);
  useEffect(() => {
    registry.addSystem(system, root);
    useEngine.getState().markLoaded(system);
    onReady();
    return () => registry.removeSystem(system);
  }, [registry, root, system, onReady]);
  return <primitive object={root} />;
}

/**
 * Loads the systems requested in the engine store (progressively) and applies the current pose,
 * configuration and highlighting every frame. Contains no vehicle-specific logic.
 */
export function VehicleModel() {
  const { registry, pose } = useEngineContext();
  const manifest = registry.manifest;
  const manifestUrl = useEngine((s) => s.manifestUrl)!;
  const requested = useEngine((s) => s.requested);
  const group = useRef<THREE.Group>(null);
  const dirty = useRef(true);
  const accent = useMemo(() => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#c8a46a'), []);
  const invalidate = useThree((s) => s.invalidate);
  const onReady = useMemo(() => () => { dirty.current = true; invalidate(); }, [invalidate]);

  useEffect(() => useEngine.subscribe((s, prev) => {
    if (s.materials !== prev.materials || s.switches !== prev.switches) dirty.current = true;
  }), []);

  useFrame((state, dt) => {
    const { selected, hovered, materials, switches, reducedMotion } = useEngine.getState();
    const p = pose.current;
    if (group.current) group.current.rotation.y = p.yaw;
    applyExplodedView(registry, p.explode);
    applySystemOpacity(registry, p.opacity);
    applyHighlight(registry, selected, hovered, accent, state.clock.elapsedTime, reducedMotion);
    if (dirty.current) {
      applySwitches(registry, manifest, switches);
      dirty.current = applyMaterialGroups(registry, manifest, materials, dt, reducedMotion);
    }
  });

  const interactiveHit = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!VehicleRegistry.isEffectivelyVisible(e.object)) return null;
    const id = VehicleRegistry.componentOf(e.object);
    if (!id) return null;
    const c = registry.components.get(id);
    const { interactive } = useEngine.getState();
    if (!c || !interactive.includes(c.mapping.system)) return null;
    if ((pose.current.opacity[c.mapping.system] ?? 0) < 0.5) return null;
    return id;
  };

  return (
    <group
      ref={group}
      onPointerMove={(e) => {
        const id = interactiveHit(e);
        if (!id) return; // let the next intersection (behind a ghosted body) handle it
        e.stopPropagation();
        if (useEngine.getState().hovered !== id) useEngine.setState({ hovered: id });
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => { useEngine.setState({ hovered: null }); document.body.style.cursor = ''; }}
      onClick={(e) => {
        if (e.delta > 6) return; // drag, not click
        const id = interactiveHit(e);
        if (!id) return;
        e.stopPropagation();
        useEngine.setState({ selected: id });
      }}
    >
      {(Object.entries(manifest.assets) as [VehicleSystem, { url: string; lodUrl?: string }][])
        .filter(([s]) => requested.includes(s))
        .map(([system, asset]) => {
          const lowQuality = useEngine.getState().quality === 'low';
          const url = resolveAssetUrl(manifestUrl, lowQuality && asset.lodUrl ? asset.lodUrl : asset.url);
          return (
            <AssetBoundary key={system} system={system}>
              <Suspense fallback={null}><SystemAsset system={system} url={url} onReady={onReady} /></Suspense>
            </AssetBoundary>
          );
        })}
    </group>
  );
}
