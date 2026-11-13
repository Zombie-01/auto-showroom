import * as THREE from 'three';
import type { ComponentMapping, VehicleManifest, VehicleSystem, Vec3 } from '@showroom/shared';

type Mat = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

export interface RegisteredNode { object: THREE.Object3D; rest: { position: Vec3; rotation: Vec3 } }
export interface RegisteredComponent { mapping: ComponentMapping; nodes: RegisteredNode[]; materials: Mat[] }
export interface RegisteredSystem {
  root: THREE.Object3D;
  materials: { material: Mat; baseOpacity: number; baseTransparent: boolean }[];
  lastOpacity: number;
}

const isMat = (m: THREE.Material): m is Mat => (m as Mat).isMeshStandardMaterial === true;

/**
 * Vehicle-agnostic bookkeeping for a loaded vehicle. Everything vehicle-specific comes from the
 * manifest; this class only knows about nodes, materials and components by name.
 */
export class VehicleRegistry {
  systems = new Map<VehicleSystem, RegisteredSystem>();
  components = new Map<string, RegisteredComponent>();
  materialsByName = new Map<string, Mat[]>();
  nodesByName = new Map<string, THREE.Object3D>();
  version = 0;

  constructor(public manifest: VehicleManifest) {}

  /**
   * Register a system's scene. The scene must be a private clone: materials are cloned per
   * component here so highlighting one part never bleeds into another sharing a material.
   */
  addSystem(system: VehicleSystem, root: THREE.Object3D) {
    root.traverse((o) => { if (o.name) this.nodesByName.set(o.name, o); });
    const owned = new Set<THREE.Object3D>();

    for (const mapping of this.manifest.components.filter((c) => c.system === system)) {
      const nodes: RegisteredNode[] = [];
      const materials: Mat[] = [];
      for (const name of mapping.nodes) {
        const obj = this.nodesByName.get(name);
        if (!obj) { console.warn(`[vehicle] component "${mapping.id}": node "${name}" missing`); continue; }
        nodes.push({ object: obj, rest: { position: obj.position.toArray() as Vec3, rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z] } });
        obj.traverse((child) => {
          child.userData.componentId = mapping.id;
          owned.add(child);
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          const cloneOne = (m: THREE.Material) => { const c = m.clone(); c.name = m.name; if (isMat(c)) { c.userData.baseEmissive = c.emissive.clone(); c.userData.baseEmissiveIntensity = c.emissiveIntensity; materials.push(c); } return c; };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneOne) : cloneOne(mesh.material);
        });
      }
      this.components.set(mapping.id, { mapping, nodes, materials });
    }

    const sysMaterials: RegisteredSystem['materials'] = [];
    const seen = new Set<THREE.Material>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!owned.has(mesh)) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!isMat(m) || seen.has(m)) continue;
        seen.add(m);
        sysMaterials.push({ material: m, baseOpacity: m.opacity, baseTransparent: m.transparent });
        const list = this.materialsByName.get(m.name) ?? [];
        list.push(m);
        this.materialsByName.set(m.name, list);
      }
    });
    this.systems.set(system, { root, materials: sysMaterials, lastOpacity: -1 });
    this.version++;
  }

  removeSystem(system: VehicleSystem) {
    const s = this.systems.get(system);
    if (!s) return;
    for (const { material } of s.materials) {
      material.dispose();
      const list = this.materialsByName.get(material.name);
      if (list) this.materialsByName.set(material.name, list.filter((m) => m !== material));
    }
    for (const [id, c] of this.components) if (c.mapping.system === system) this.components.delete(id);
    s.root.traverse((o) => { if (o.name && this.nodesByName.get(o.name) === o) this.nodesByName.delete(o.name); });
    this.systems.delete(system);
    this.version++;
  }

  /** Walk up from a raycast hit to the owning component id. */
  static componentOf(obj: THREE.Object3D | null): string | null {
    for (let o = obj; o; o = o.parent) if (o.userData.componentId) return o.userData.componentId as string;
    return null;
  }

  static isEffectivelyVisible(obj: THREE.Object3D) {
    for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (!o.visible) return false;
    return true;
  }
}
