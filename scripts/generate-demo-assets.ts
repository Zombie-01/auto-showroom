/**
 * Generates DEMONSTRATION 3D assets for the showroom pipeline.
 *
 * These are stylised primitive-based stand-ins. They are NOT a model of any real vehicle and
 * must never be presented as one. They exist so the rendering engine, manifest mapping,
 * exploded views and material groups can be built and tested before licensed/production
 * assets are delivered. Replace them by dropping production GLBs that use the same node
 * and material names (see docs/3D_ASSET_PIPELINE.md).
 *
 * Usage: npm run assets:demo [-- --vehicle toyota/land-cruiser-300]
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildManifest, DISCLAIMER } from './demo-manifest';

// --- Node polyfill: GLTFExporter uses FileReader for binary output -------------------------
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onload: ((e: unknown) => void) | null = null;
  onloadend: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((b) => { this.result = b; this.onload?.({ target: this }); this.onloadend?.({ target: this }); });
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
      this.onload?.({ target: this }); this.onloadend?.({ target: this });
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

// --- Materials ---------------------------------------------------------------------------
const materials = new Map<string, THREE.MeshPhysicalMaterial>();
function mat(name: string, hex: string, metalness: number, roughness: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  let m = materials.get(name);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ name, color: new THREE.Color(hex), metalness, roughness, ...extra });
    materials.set(name, m);
  }
  return m;
}
const M = {
  body: () => mat('mat_body', '#d9d6cf', 0.55, 0.32, { clearcoat: 1, clearcoatRoughness: 0.08 }),
  roof: () => mat('mat_roof', '#d9d6cf', 0.55, 0.32, { clearcoat: 1, clearcoatRoughness: 0.08 }),
  trim: () => mat('mat_trim', '#1c1d1f', 0.2, 0.55),
  chrome: () => mat('mat_chrome', '#c9ccd1', 1, 0.12),
  glass: () => mat('mat_glass', '#0d1013', 0.1, 0.05, { transparent: true, opacity: 0.82 }),
  lightFront: () => mat('mat_light_front', '#f4f6f8', 0.2, 0.1, { emissive: new THREE.Color('#dfe8ff'), emissiveIntensity: 0.6 }),
  lightRear: () => mat('mat_light_rear', '#7a0d10', 0.2, 0.2, { emissive: new THREE.Color('#ff1c22'), emissiveIntensity: 0.45 }),
  tire: () => mat('mat_tire', '#141414', 0, 0.85),
  rim: () => mat('mat_rim', '#a8abb0', 0.9, 0.28),
  seat: () => mat('mat_seat', '#3a2c22', 0, 0.62, { sheen: 0.4 }),
  interior: () => mat('mat_interior', '#26262a', 0.05, 0.7),
  dash: () => mat('mat_dash_finish', '#5a4632', 0.1, 0.4),
  intTrim: () => mat('mat_interior_trim', '#8d8f93', 0.85, 0.3),
  screen: () => mat('mat_screen', '#05070a', 0.2, 0.08, { emissive: new THREE.Color('#1d3a5c'), emissiveIntensity: 0.5 }),
  engineMetal: () => mat('mat_engine_alloy', '#8e9196', 0.85, 0.38),
  engineDark: () => mat('mat_engine_dark', '#2a2b2e', 0.6, 0.5),
  engineAccent: () => mat('mat_engine_accent', '#b0472f', 0.4, 0.45),
  copper: () => mat('mat_copper', '#b87333', 0.95, 0.3),
  steel: () => mat('mat_steel', '#5d6166', 0.9, 0.42),
  rubber: () => mat('mat_rubber', '#1a1a1a', 0, 0.9),
  spring: () => mat('mat_spring', '#c23b2a', 0.5, 0.4),
  brake: () => mat('mat_brake_disc', '#7d7f84', 0.95, 0.35),
  caliper: () => mat('mat_caliper', '#a3292d', 0.4, 0.4),
  safety: () => mat('mat_safety', '#8c7a4a', 0.1, 0.7),
};

// --- Geometry helpers -------------------------------------------------------------------
type V3 = [number, number, number];
function mesh(name: string, geo: THREE.BufferGeometry, material: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, material);
  m.name = name; m.position.set(...pos); m.rotation.set(...rot);
  return m;
}
/** Box between two corners — pivot at the box centre so exploded rotations behave. */
function boxFromTo(name: string, a: V3, b: V3, material: THREE.Material, rot: V3 = [0, 0, 0]) {
  const size: V3 = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])];
  const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return mesh(name, new THREE.BoxGeometry(...size), material, c, rot);
}
/** Cylinder whose axis is X, Y or Z. */
function cyl(name: string, r: number, len: number, pos: V3, axis: 'x' | 'y' | 'z', material: THREE.Material, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return mesh(name, g, material, pos);
}
/** Tube between two points (hoses, shafts, links). */
function rod(name: string, a: V3, b: V3, r: number, material: THREE.Material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, 16);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}
function group(name: string, children: THREE.Object3D[], pos: V3 = [0, 0, 0]) {
  const g = new THREE.Group(); g.name = name; g.position.set(...pos);
  for (const c of children) g.add(c);
  return g;
}
/** Re-centre a group's children so the group's origin sits at their bounding-box centre. */
function centred(name: string, children: THREE.Object3D[]) {
  const g = group(name, children);
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  for (const ch of children) ch.position.sub(c);
  g.position.copy(c);
  return g;
}
function extrudeXY(name: string, pts: [number, number][], depth: number, material: THREE.Material, zCentre = 0, bevel = 0.035) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
  g.translate(0, 0, -depth / 2 + zCentre);
  return mesh(name, g, material);
}
function helix(name: string, radius: number, height: number, turns: number, wire: number, pos: V3, material: THREE.Material) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 48; i++) {
    const t = i / (turns * 48);
    pts.push(new THREE.Vector3(Math.cos(t * turns * Math.PI * 2) * radius, t * height - height / 2, Math.sin(t * turns * Math.PI * 2) * radius));
  }
  return mesh(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 48, wire, 8, false), material, pos);
}

// --- Vehicle dimensions (demonstration proportions only) ---------------------------------
const WB = 2.85, AX = WB / 2, WR = 0.42, TRACK_Z = 0.84, HALF_W = 0.95;
const corners: { id: string; x: number; z: number }[] = [
  { id: 'FL', x: AX, z: -TRACK_Z }, { id: 'FR', x: AX, z: TRACK_Z },
  { id: 'RL', x: -AX, z: -TRACK_Z }, { id: 'RR', x: -AX, z: TRACK_Z },
];

function buildExterior() {
  // Hollow body: two side panels carrying the full profile (with wheel arches), a solid engine-bay
  // block forward of the cabin and a tail panel. The cabin itself stays open so interior views work.
  const body = (() => {
    const profile = () => {
      const s = new THREE.Shape();
      s.moveTo(2.38, 0.45);
      s.lineTo(AX + 0.52, 0.45);
      s.absarc(AX, 0.45, 0.52, 0, Math.PI, false);
      s.lineTo(-AX + 0.52, 0.45);
      s.absarc(-AX, 0.45, 0.52, 0, Math.PI, false);
      s.lineTo(-2.4, 0.45);
      s.lineTo(-2.4, 1.1);
      s.lineTo(1.2, 1.1);
      s.lineTo(1.32, 1.0);
      s.lineTo(2.3, 0.98);
      s.quadraticCurveTo(2.38, 0.96, 2.38, 0.86);
      s.lineTo(2.38, 0.45);
      return s;
    };
    const PANEL = 0.07;
    const side = (z: number, name: string) => {
      const g = new THREE.ExtrudeGeometry(profile(), { depth: PANEL, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 32 });
      g.translate(0, 0, z - PANEL / 2);
      return mesh(name, g, M.body());
    };
    const archEnd = Math.acos((1.2 - AX) / 0.52);
    const front = new THREE.Shape();
    front.moveTo(2.38, 0.45);
    front.lineTo(AX + 0.52, 0.45);
    front.absarc(AX, 0.45, 0.52, 0, archEnd, false);
    front.lineTo(1.2, 1.1);
    front.lineTo(1.32, 1.0);
    front.lineTo(2.3, 0.98);
    front.quadraticCurveTo(2.38, 0.96, 2.38, 0.86);
    front.lineTo(2.38, 0.45);
    const inner = HALF_W * 2 - 0.2;
    const frontGeo = new THREE.ExtrudeGeometry(front, { depth: inner, bevelEnabled: false, curveSegments: 24 });
    frontGeo.translate(0, 0, -inner / 2);
    return group('body_shell', [
      side(-(HALF_W - 0.06), 'body_side_L'),
      side(HALF_W - 0.06, 'body_side_R'),
      mesh('body_front', frontGeo, M.body()),
      boxFromTo('body_tail', [-2.42, 0.45, -inner / 2], [-2.32, 1.1, inner / 2], M.body()),
      boxFromTo('body_floor', [-2.35, 0.45, -inner / 2], [1.2, 0.52, inner / 2], M.trim()),
    ]);
  })();

  const greenhouse = extrudeXY('windows', [[-2.34, 1.1], [-2.28, 1.83], [0.62, 1.86], [1.18, 1.13]], 1.7, M.glass(), 0, 0.03);
  const pillars = [
    rod('pillar_a_L', [1.16, 1.13, -0.86], [0.6, 1.85, -0.84], 0.035, M.trim()),
    rod('pillar_a_R', [1.16, 1.13, 0.86], [0.6, 1.85, 0.84], 0.035, M.trim()),
  ];
  const roof = centred('roof', [boxFromTo('roof_panel', [-2.26, 1.86, -0.86], [0.6, 1.92, 0.86], M.roof())]);
  const hood = centred('hood', [boxFromTo('hood_panel', [1.32, 0.99, -0.9], [2.3, 1.04, 0.9], M.body())]);

  const grille = centred('grille', [
    boxFromTo('grille_frame', [2.39, 0.6, -0.56], [2.45, 0.94, 0.56], M.chrome()),
    ...[0, 1, 2, 3, 4].map((i) => boxFromTo(`grille_slat_${i}`, [2.445, 0.64 + i * 0.06, -0.52], [2.47, 0.665 + i * 0.06, 0.52], M.trim())),
  ]);
  const headlights = ['L', 'R'].map((side) => {
    const z = side === 'L' ? -1 : 1;
    return centred(`headlight_${side}`, [
      boxFromTo(`headlight_housing_${side}`, [2.36, 0.83, z * 0.6], [2.43, 0.96, z * 0.92], M.trim()),
      boxFromTo(`headlight_lens_${side}`, [2.43, 0.85, z * 0.62], [2.445, 0.94, z * 0.9], M.lightFront()),
    ]);
  });
  const frontBumper = centred('front_bumper', [
    boxFromTo('front_bumper_cover', [2.36, 0.4, -0.98], [2.52, 0.6, 0.98], M.trim()),
    boxFromTo('front_skid_plate', [2.3, 0.32, -0.6], [2.48, 0.4, 0.6], M.intTrim()),
  ]);
  const rearBumper = centred('rear_bumper', [boxFromTo('rear_bumper_cover', [-2.53, 0.4, -0.98], [-2.38, 0.66, 0.98], M.trim())]);
  const taillights = ['L', 'R'].map((side) => {
    const z = side === 'L' ? -1 : 1;
    return centred(`taillight_${side}`, [boxFromTo(`taillight_lens_${side}`, [-2.46, 0.82, z * 0.7], [-2.39, 1.06, z * 0.93], M.lightRear())]);
  });
  const door = (id: string, x0: number, x1: number, side: number) =>
    centred(`door_${id}`, [
      boxFromTo(`door_${id}_skin`, [x1, 0.56, side * 0.985], [x0, 1.09, side * 1.0], M.body()),
      boxFromTo(`door_${id}_handle`, [x0 - 0.2, 0.98, side * 1.0], [x0 - 0.06, 1.0, side * 1.012], M.chrome()),
    ]);
  const doors = [door('FL', 0.88, -0.14, -1), door('FR', 0.88, -0.14, 1), door('RL', -0.17, -0.9, -1), door('RR', -0.17, -0.9, 1)];
  const mirrors = ['L', 'R'].map((side) => {
    const z = side === 'L' ? -1 : 1;
    return centred(`mirror_${side}`, [
      boxFromTo(`mirror_arm_${side}`, [1.0, 1.14, z * 0.96], [1.08, 1.18, z * 1.04], M.trim()),
      boxFromTo(`mirror_head_${side}`, [0.98, 1.12, z * 1.03], [1.1, 1.28, z * 1.2], M.body()),
    ]);
  });

  const wheels = corners.map(({ id, x, z }) => {
    const side = Math.sign(z);
    const tireProfile = [[0.3, -0.14], [0.38, -0.145], [0.412, -0.12], [WR, 0], [0.412, 0.12], [0.38, 0.145], [0.3, 0.14]].map(([r, y]) => new THREE.Vector2(r!, y!));
    const tireGeo = new THREE.LatheGeometry(tireProfile, 48);
    tireGeo.rotateX(Math.PI / 2);
    const rimA = group(`rim_a_${id}`, [
      cyl(`rim_a_barrel_${id}`, 0.3, 0.26, [0, 0, 0], 'z', M.rim(), 40),
      cyl(`rim_a_hub_${id}`, 0.07, 0.04, [0, 0, side * 0.14], 'z', M.chrome()),
      ...Array.from({ length: 6 }, (_, i) => mesh(`rim_a_spoke_${id}_${i}`, new THREE.BoxGeometry(0.07, 0.26, 0.03), M.rim(), [Math.cos((i / 6) * Math.PI * 2) * 0.14, Math.sin((i / 6) * Math.PI * 2) * 0.14, side * 0.135], [0, 0, (i / 6) * Math.PI * 2 - Math.PI / 2])),
    ]);
    const rimB = group(`rim_b_${id}`, [
      cyl(`rim_b_barrel_${id}`, 0.3, 0.26, [0, 0, 0], 'z', M.rim(), 40),
      cyl(`rim_b_hub_${id}`, 0.06, 0.04, [0, 0, side * 0.14], 'z', M.trim()),
      ...Array.from({ length: 12 }, (_, i) => mesh(`rim_b_spoke_${id}_${i}`, new THREE.BoxGeometry(0.025, 0.25, 0.025), M.rim(), [Math.cos((i / 12) * Math.PI * 2) * 0.15, Math.sin((i / 12) * Math.PI * 2) * 0.15, side * 0.135], [0, 0, (i / 12) * Math.PI * 2 - Math.PI / 2])),
    ]);
    rimB.visible = false;
    return group(`wheel_${id}`, [mesh(`tire_${id}`, tireGeo, M.tire()), rimA, rimB], [x, WR, z]);
  });

  // Accessories (visibility switches)
  const roofRack = group('acc_roof_rack', [
    rod('roof_rail_L', [-2.1, 1.97, -0.7], [0.4, 1.97, -0.7], 0.02, M.trim()),
    rod('roof_rail_R', [-2.1, 1.97, 0.7], [0.4, 1.97, 0.7], 0.02, M.trim()),
    ...[-1.6, -0.6, 0.2].map((x, i) => rod(`roof_bar_${i}`, [x, 1.98, -0.72], [x, 1.98, 0.72], 0.018, M.trim())),
  ]);
  roofRack.visible = false;
  const steps = group('acc_side_steps', ['L', 'R'].map((side) =>
    boxFromTo(`side_step_${side}`, [0.85, 0.36, (side === 'L' ? -1 : 1) * 0.92], [-0.9, 0.4, (side === 'L' ? -1 : 1) * 1.08], M.intTrim())));
  steps.visible = false;

  return group('exterior', [body, greenhouse, ...pillars, roof, hood, grille, ...headlights, frontBumper, rearBumper, ...taillights, ...doors, ...mirrors, ...wheels, roofRack, steps]);
}

function buildEngine() {
  const E: V3 = [1.82, 0.7, 0];
  const at = (dx: number, dy: number, dz: number): V3 => [E[0] + dx, E[1] + dy, E[2] + dz];
  const block = centred('engine_block', [
    boxFromTo('engine_block_main', at(-0.3, -0.18, -0.2), at(0.3, 0.12, 0.2), M.engineMetal()),
    boxFromTo('engine_oil_pan', at(-0.26, -0.28, -0.16), at(0.24, -0.18, 0.16), M.engineDark()),
  ]);
  const heads = (['L', 'R'] as const).map((side) => {
    const s = side === 'L' ? -1 : 1;
    return centred(`cylinder_head_${side}`, [
      boxFromTo(`cylinder_head_${side}_body`, at(-0.29, 0.1, s * 0.08), at(0.29, 0.2, s * 0.3), M.engineMetal(), [s * -0.5, 0, 0]),
      boxFromTo(`valve_cover_${side}`, at(-0.27, 0.2, s * 0.12), at(0.27, 0.25, s * 0.3), M.engineAccent(), [s * -0.5, 0, 0]),
    ]);
  });
  const pistons = group('pistons', Array.from({ length: 6 }, (_, i) => {
    const bank = i % 2 === 0 ? -1 : 1;
    const x = -0.2 + Math.floor(i / 2) * 0.19 + (bank > 0 ? 0.04 : 0);
    return group(`piston_${i + 1}`, [
      cyl(`piston_${i + 1}_crown`, 0.045, 0.06, at(x, 0.02, bank * 0.1), 'y', M.engineMetal(), 24),
      rod(`piston_${i + 1}_rod`, at(x, 0, bank * 0.1), at(x, -0.13, bank * 0.02), 0.012, M.steel()),
    ]);
  }));
  const crank = centred('crankshaft', [
    cyl('crankshaft_main', 0.025, 0.66, at(0, -0.14, 0), 'x', M.steel(), 20),
    ...[-0.2, -0.01, 0.18].map((x, i) => boxFromTo(`crank_throw_${i}`, at(x - 0.02, -0.19, -0.04), at(x + 0.02, -0.1, 0.04), M.steel())),
    cyl('crank_pulley', 0.08, 0.04, at(0.35, -0.14, 0), 'x', M.engineDark()),
  ]);
  const turbos = (['L', 'R'] as const).map((side) => {
    const s = side === 'L' ? -1 : 1;
    const g = new THREE.TorusGeometry(0.07, 0.035, 12, 32);
    return centred(`turbo_${side}`, [
      mesh(`turbo_${side}_housing`, g, M.engineMetal(), at(-0.12, -0.02, s * 0.4), [0, Math.PI / 2, 0]),
      cyl(`turbo_${side}_core`, 0.05, 0.12, at(-0.12, -0.02, s * 0.4), 'x', M.copper()),
    ]);
  });
  const intake = centred('intake_system', [
    boxFromTo('intake_plenum', at(-0.24, 0.24, -0.09), at(0.22, 0.34, 0.09), M.engineDark()),
    cyl('throttle_body', 0.045, 0.1, at(0.27, 0.29, 0), 'x', M.engineMetal()),
    rod('intake_pipe_L', at(0.3, 0.29, 0), at(0.42, 0.2, -0.3), 0.04, M.rubber()),
  ]);
  const cooling = centred('cooling_system', [
    boxFromTo('radiator_core', at(0.44, -0.2, -0.62), at(0.5, 0.22, 0.62), M.engineMetal()),
    cyl('cooling_fan', 0.2, 0.04, at(0.4, 0.0, 0), 'x', M.engineDark(), 40),
    rod('coolant_hose_upper', at(0.43, 0.18, 0.3), at(0.25, 0.14, 0.12), 0.022, M.rubber()),
  ]);
  const exhaust = centred('exhaust_system', [
    rod('exhaust_manifold_L', at(-0.2, -0.05, -0.3), at(0.2, -0.05, -0.3), 0.03, M.copper()),
    rod('exhaust_manifold_R', at(-0.2, -0.05, 0.3), at(0.2, -0.05, 0.3), 0.03, M.copper()),
    rod('exhaust_downpipe', at(-0.3, -0.12, 0.34), at(-0.55, -0.32, 0.3), 0.035, M.steel()),
  ]);
  const alternator = centred('alternator', [cyl('alternator_body', 0.06, 0.12, at(0.3, 0.06, 0.22), 'x', M.engineMetal(), 24)]);
  return group('engine', [block, ...heads, pistons, crank, ...turbos, intake, cooling, exhaust, alternator]);
}

function buildTransmission() {
  const torque = centred('torque_converter', [cyl('torque_converter_bell', 0.16, 0.16, [1.44, 0.6, 0], 'x', M.engineMetal(), 32, 0.2)]);
  const gearbox = centred('gearbox', [cyl('gearbox_case', 0.11, 0.62, [1.05, 0.58, 0], 'x', M.engineMetal(), 28, 0.16)]);
  const transfer = centred('transfer_case', [boxFromTo('transfer_case_body', [0.58, 0.46, -0.1], [0.74, 0.66, 0.16], M.engineDark())]);
  const shaftRear = centred('driveshaft', [
    rod('driveshaft_rear', [0.56, 0.52, 0], [-AX + 0.14, 0.44, 0], 0.035, M.steel()),
    rod('driveshaft_front', [0.66, 0.5, 0.13], [AX - 0.12, 0.42, 0.13], 0.03, M.steel()),
  ]);
  const diffs = centred('differentials', [
    mesh('diff_rear', new THREE.SphereGeometry(0.14, 24, 16), M.engineDark(), [-AX, WR, 0]),
    mesh('diff_front', new THREE.SphereGeometry(0.11, 24, 16), M.engineDark(), [AX, WR, 0.13]),
  ]);
  const axles = centred('axles', [
    cyl('axle_rear', 0.045, TRACK_Z * 2 - 0.3, [-AX, WR, 0], 'z', M.steel()),
    rod('halfshaft_front_L', [AX, WR, 0.05], [AX, WR, -TRACK_Z + 0.16], 0.028, M.steel()),
    rod('halfshaft_front_R', [AX, WR, 0.2], [AX, WR, TRACK_Z - 0.16], 0.028, M.steel()),
  ]);
  return group('transmission', [torque, gearbox, transfer, shaftRear, diffs, axles]);
}

function buildSuspension() {
  const frame = centred('frame', [
    boxFromTo('frame_rail_L', [-2.25, 0.44, -0.53], [2.3, 0.58, -0.45], M.steel()),
    boxFromTo('frame_rail_R', [-2.25, 0.44, 0.45], [2.3, 0.58, 0.53], M.steel()),
    ...[-2.1, -1.0, 0.2, 1.1, 2.15].map((x, i) => boxFromTo(`crossmember_${i}`, [x - 0.04, 0.46, -0.45], [x + 0.04, 0.54, 0.45], M.steel())),
  ]);
  const arms = centred('control_arms', (['L', 'R'] as const).flatMap((side) => {
    const s = side === 'L' ? -1 : 1;
    return [
      rod(`upper_arm_${side}`, [AX + 0.1, 0.66, s * 0.48], [AX, 0.6, s * (TRACK_Z - 0.2)], 0.022, M.steel()),
      rod(`upper_arm_${side}_b`, [AX - 0.12, 0.66, s * 0.48], [AX, 0.6, s * (TRACK_Z - 0.2)], 0.022, M.steel()),
      rod(`lower_arm_${side}`, [AX + 0.16, 0.36, s * 0.46], [AX, 0.3, s * (TRACK_Z - 0.16)], 0.028, M.steel()),
      rod(`lower_arm_${side}_b`, [AX - 0.18, 0.36, s * 0.46], [AX, 0.3, s * (TRACK_Z - 0.16)], 0.028, M.steel()),
    ];
  }));
  const frontSusp = centred('front_suspension', [
    ...(['L', 'R'] as const).map((side) => boxFromTo(`knuckle_${side}`, [AX - 0.05, 0.28, (side === 'L' ? -1 : 1) * (TRACK_Z - 0.2)], [AX + 0.05, 0.62, (side === 'L' ? -1 : 1) * (TRACK_Z - 0.14)], M.engineDark())),
    rod('stabilizer_bar_front', [AX + 0.25, 0.4, -0.6], [AX + 0.25, 0.4, 0.6], 0.016, M.engineDark()),
  ]);
  const rearSusp = centred('rear_suspension', [
    ...(['L', 'R'] as const).map((side) => rod(`trailing_link_${side}`, [-0.55, 0.42, (side === 'L' ? -1 : 1) * 0.55], [-AX + 0.05, WR - 0.05, (side === 'L' ? -1 : 1) * 0.6], 0.025, M.steel())),
    rod('panhard_rod', [-AX - 0.12, 0.5, -0.5], [-AX - 0.12, 0.42, 0.5], 0.02, M.steel()),
  ]);
  const springs = centred('springs', corners.map(({ id, x, z }) => helix(`coil_spring_${id}`, 0.075, 0.36, 6, 0.012, [x + (x > 0 ? 0 : 0.08), 0.62, Math.sign(z) * (x > 0 ? 0.62 : 0.52)], M.spring())));
  const shocks = centred('shock_absorbers', corners.map(({ id, x, z }) => cyl(`shock_${id}`, 0.025, 0.46, [x + (x > 0 ? 0 : 0.08), 0.62, Math.sign(z) * (x > 0 ? 0.62 : 0.52)], 'y', M.engineDark(), 16)));
  const brakes = group('braking_system', corners.map(({ id, x, z }) => centred(`brake_${id}`, [
    cyl(`brake_disc_${id}`, 0.19, 0.03, [x, WR, z - Math.sign(z) * 0.06], 'z', M.brake(), 40),
    boxFromTo(`brake_caliper_${id}`, [x + 0.08, WR + 0.1, z - Math.sign(z) * 0.1], [x + 0.2, WR + 0.2, z - Math.sign(z) * 0.03], M.caliper()),
  ])));
  const steering = centred('steering', [
    cyl('steering_rack', 0.03, 0.9, [AX + 0.22, 0.46, 0], 'z', M.engineMetal()),
    rod('tie_rod_L', [AX + 0.22, 0.46, -0.45], [AX + 0.1, 0.42, -(TRACK_Z - 0.18)], 0.014, M.steel()),
    rod('tie_rod_R', [AX + 0.22, 0.46, 0.45], [AX + 0.1, 0.42, TRACK_Z - 0.18], 0.014, M.steel()),
    rod('steering_column', [AX + 0.22, 0.48, -0.36], [0.72, 1.0, -0.42], 0.022, M.steel()),
  ]);
  return group('suspension', [frame, arms, frontSusp, rearSusp, springs, shocks, brakes, steering]);
}

function buildInterior() {
  const D = -0.42; // driver lateral position (left-hand drive layout)
  const dashboard = centred('dashboard', [
    boxFromTo('dash_upper', [0.82, 0.98, -0.86], [1.18, 1.16, 0.86], M.interior()),
    boxFromTo('dash_trim_strip', [0.8, 0.96, -0.86], [0.84, 1.0, 0.86], M.dash()),
    boxFromTo('dash_lower', [0.9, 0.62, -0.86], [1.12, 0.98, 0.86], M.interior()),
  ]);
  const cluster = centred('instrument_cluster', [boxFromTo('cluster_screen', [0.86, 1.12, D - 0.2], [0.89, 1.24, D + 0.2], M.screen(), [0, 0, 0.35])]);
  const infotainment = centred('infotainment', [boxFromTo('infotainment_screen', [0.8, 1.12, -0.17], [0.83, 1.32, 0.17], M.screen(), [0, 0, 0.2])]);
  const climate = centred('climate_control', [
    boxFromTo('climate_panel', [0.84, 0.94, -0.16], [0.88, 1.06, 0.16], M.interior()),
    ...[-0.1, 0, 0.1].map((z, i) => cyl(`climate_knob_${i}`, 0.018, 0.02, [0.83, 1.0, z], 'x', M.intTrim(), 20)),
  ]);
  const wheelGeo = new THREE.TorusGeometry(0.19, 0.022, 14, 48);
  const steeringWheel = centred('steering_wheel', [
    mesh('steering_wheel_rim', wheelGeo, M.interior(), [0.62, 1.05, D], [0, Math.PI / 2, 0.45]),
    boxFromTo('steering_wheel_spoke', [0.6, 1.0, D - 0.17], [0.64, 1.04, D + 0.17], M.intTrim(), [0, 0, 0.45]),
  ]);
  const safety = centred('safety_systems', [
    cyl('airbag_driver_module', 0.07, 0.05, [0.6, 1.05, D], 'x', M.safety(), 24),
    boxFromTo('curtain_airbag_L', [-1.9, 1.74, -0.83], [0.7, 1.78, -0.8], M.safety()),
    boxFromTo('curtain_airbag_R', [-1.9, 1.74, 0.8], [0.7, 1.78, 0.83], M.safety()),
  ]);
  const seat = (id: string, x: number, z: number, w: number) => centred(`seat_${id}`, [
    boxFromTo(`seat_${id}_base`, [x - 0.26, 0.62, z - w / 2], [x + 0.26, 0.74, z + w / 2], M.seat()),
    boxFromTo(`seat_${id}_back`, [x - 0.32, 0.74, z - w / 2], [x - 0.2, 1.36, z + w / 2], M.seat(), [0, 0, -0.18]),
    boxFromTo(`seat_${id}_head`, [x - 0.36, 1.38, z - w / 4], [x - 0.28, 1.52, z + w / 4], M.seat(), [0, 0, -0.18]),
  ]);
  const seats = group('seats', [seat('FL', 0.05, D, 0.5), seat('FR', 0.05, -D, 0.5), seat('R', -0.95, 0, 1.5)]);
  const console = centred('center_console', [
    boxFromTo('console_body', [-0.45, 0.6, -0.13], [0.82, 0.86, 0.13], M.interior()),
    boxFromTo('console_trim', [-0.2, 0.86, -0.11], [0.6, 0.875, 0.11], M.dash()),
  ]);
  const panel = (id: string, x0: number, x1: number, s: number) => centred(`door_panel_${id}`, [
    boxFromTo(`door_panel_${id}_card`, [x1, 0.62, s * 0.86], [x0, 1.08, s * 0.89], M.interior()),
    boxFromTo(`door_trim_${id}`, [x0 - 0.16, 0.98, s * 0.855], [x1 + 0.1, 1.0, s * 0.86], M.intTrim()),
  ]);
  const doorPanels = group('door_panels', [panel('FL', 0.86, -0.12, -1), panel('FR', 0.86, -0.12, 1), panel('RL', -0.18, -0.88, -1), panel('RR', -0.18, -0.88, 1)]);
  const speakers = group('speakers', ['FL', 'FR', 'RL', 'RR'].map((id) => cyl(`speaker_${id}`, 0.06, 0.012, [id.startsWith('F') ? 0.55 : -0.5, 0.72, (id.endsWith('L') ? -1 : 1) * 0.85], 'z', M.intTrim(), 24)));
  const floor = boxFromTo('interior_floor', [-2.2, 0.55, -0.86], [1.0, 0.6, 0.86], M.interior());
  return group('interior', [dashboard, cluster, infotainment, climate, steeringWheel, safety, seats, console, doorPanels, speakers, floor]);
}

// --- Export ------------------------------------------------------------------------------
async function exportGlb(root: THREE.Object3D, file: string, system: string) {
  root.userData = { demonstration: true, system, disclaimer: DISCLAIMER, generator: 'scripts/generate-demo-assets.ts' };
  const scene = new THREE.Scene(); scene.add(root);
  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(scene, { binary: true, onlyVisible: false })) as ArrayBuffer;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
  const doc = await io.readBinary(new Uint8Array(glb));
  doc.getRoot().getAsset().generator = 'auto-showroom demo-asset generator (DEMONSTRATION GEOMETRY)';
  // Materials are NOT deduplicated: identical-looking groups (body/roof) must stay independently configurable.
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), prune({ keepLeaves: true, keepAttributes: false }), weld(), draco({ method: 'edgebreaker', quantizePosition: 14 }));
  const out = await io.writeBinary(doc);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, out);
  return { bytes: out.byteLength, raw: glb.byteLength };
}

async function main() {
  const vehicle = process.argv.includes('--vehicle') ? process.argv[process.argv.indexOf('--vehicle') + 1]! : 'toyota/land-cruiser-300';
  const base = path.resolve('apps/web/public/assets/vehicles', vehicle);
  const systems = { exterior: buildExterior, engine: buildEngine, transmission: buildTransmission, suspension: buildSuspension, interior: buildInterior };
  const sizes: Record<string, number> = {};
  for (const [system, build] of Object.entries(systems)) {
    const file = path.join(base, system, `demo-${system}.glb`);
    const { bytes, raw } = await exportGlb(build(), file, system);
    sizes[system] = bytes;
    console.log(`${system.padEnd(13)} ${(raw / 1024).toFixed(0).padStart(5)} KB raw → ${(bytes / 1024).toFixed(0).padStart(5)} KB draco  ${path.relative(process.cwd(), file)}`);
  }
  const manifest = buildManifest(vehicle.split('/')[1]!, sizes);
  const json = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(path.join(base, 'demo.manifest.json'), json);
  console.log(`manifest      ${path.relative(process.cwd(), path.join(base, 'demo.manifest.json'))}`);
  // vehicle.manifest.json is what the site loads. Don't overwrite an imported (evaluation/production) one.
  if (!existsSync(path.join(base, 'exterior/eval-exterior.glb'))) {
    await writeFile(path.join(base, 'vehicle.manifest.json'), json);
    console.log('manifest      vehicle.manifest.json (no imported model present — using demo)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
