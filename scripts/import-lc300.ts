/**
 * Builds the Land Cruiser 300 showroom assets from third-party source models:
 *
 *   incoming/lc300/model.glb  — LC300 VX.R (Sketchfab, ddiaz-design, CC BY-NC-SA, provenance unverified)
 *                               → exterior, interior, chassis (suspension) and real drivetrain parts
 *   incoming/v6/model.glb     — "twin turbo V6 full engine working" (Sketchfab, cmclain4200, CC BY 4.0)
 *                               → engine (illustrative — NOT the V35A-FTS)
 *   + generated demonstration geometry for gearbox / torque converter / transfer case
 *
 * Output (git-ignored, not redistributable): apps/web/public/assets/vehicles/toyota/land-cruiser-300/<system>/eval-*.glb
 * and vehicle.manifest.json. Usage: npx tsx scripts/import-lc300.ts
 */
import { Document, NodeIO, PropertyType, type Mesh, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, mergeDocuments, prune, simplify, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lintManifest, VehicleManifest, type ComponentMapping, type Keyframe, type VehicleSystem } from '../packages/shared/src/index';
import { buildManifest } from './demo-manifest';
import { splitMesh, type Island } from './lib/islands';
import { threeToDocument } from './lib/three-export';

const CAR = 'incoming/lc300/model.glb';
const PLANETARY = 'incoming/planetary/model.glb';
const HYPOID = 'incoming/hypoid/model.glb';
const CREDIT_PLANETARY = '“Gearbox (Planetary)” by tflexcad, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/2bee7992d266456aaef1f1394b0ebb98';
const CREDIT_HYPOID = '“Hypoid Gear” by cyamahat (CAD: Dr Lunin), Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/6592b808326541dd8b887bcf3da44619';
const ENGINE = 'incoming/v6/model.glb';
const OUT = path.resolve('apps/web/public/assets/vehicles/toyota/land-cruiser-300');

const CREDIT_CAR = '“2022 Toyota Land Cruiser 300 VX.R” by ddiaz-design, Sketchfab, CC BY-NC-SA 4.0 — https://sketchfab.com/3d-models/3dfcd7904cdb4e52afa3ce59fa59e1a5';
const CREDIT_ENGINE = '“twin turbo V6 full engine working” by cmclain4200, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/cd81a914d52f40ce9504e54d5c3f559c';
const DISCLAIMER = 'Гуравдагч этгээдийн туршилтын 3D загвар (Sketchfab). Машины загвар арилжааны бус лицензтэй, гарал үүсэл нь баталгаажаагүй; хөдөлгүүр нь V35A-FTS биш, ерөнхий хос турбо V6-ийн жишээ загвар. Зөвхөн дотоод танилцуулгад — арилжаанд ашиглахаас өмнө лицензтэй загвараар солих шаардлагатай.';
const NOTE_ENGINE = 'Жишээ хос турбо V6 загвар (CC BY, cmclain4200). Нэг хий түгээх голтой, коромыслотой ерөнхий бүтэц — жинхэнэ V35A-FTS нь хоёр дээд хий түгээх голтой (DOHC). Хэлбэрийг бус, үүргийг харуулах зорилготой.';
const NOTE_DEMO = 'Хялбаршуулсан үзүүлэн геометр — энэ эд ангийн нарийвчилсан загвар хараахан байхгүй.';
const NOTE_PLANETARY = 'Бодит CAD гаригийн арааны багц (CC BY, tflexcad) — автомат хайрцаг дотор хэд хэдэн ийм багц дараалан байрладаг зарчмыг харуулна. Toyota 10AT-ийн яг хэлбэр биш.';
const NOTE_HYPOID = 'Бодит CAD гипоид араа (CC BY, cyamahat) — тэнхлэгийн дифференциалын титэм араа ба шовгор арааны зарчмыг харуулна. Харьцаа нь LC300-ийнхтой ижил биш.';
const NOTE_CAR = 'Гуравдагч этгээдийн Land Cruiser 300 туршилтын загвараас; нарийн хэсгүүд нь жинхэнэ машинаас ялгаатай байж болно.';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;

// ---- Coordinate frames ---------------------------------------------------------------------
// Vehicle space: metres, +X forward, +Y up, +Z right, ground y=0, origin midway between axles.
/** LC300 source: centimetre-scaled, +Y up, +Z forward. Measured: scale ×100.24, axle midpoint 0.14 m. */
const CAR_TO_VEHICLE = new THREE.Matrix4().makeTranslation(-0.14, 0.004, 0)
  .multiply(new THREE.Matrix4().makeScale(100.24, 100.24, 100.24))
  .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
/** V6 source (world): metres, crank along X (timing cover at −X), +Z up, Y lateral → engine bay. */
const ENGINE_TO_VEHICLE = new THREE.Matrix4().makeTranslation(1.52, 0.59, 0)
  .multiply(new THREE.Matrix4().set(-1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1));

const world = (n: Node) => new THREE.Matrix4().fromArray(n.getWorldMatrix() as unknown as number[]);
const keyOf = (name: string) => name.replace(/^T:/, '').replace(/^(S[KM]_[A-Za-z_]+?_101(_001)?)_.*$/, '$1');
const side = (z: number) => (z < 0 ? 'L' : 'R');
const corner = (c: THREE.Vector3) => `${c.x > 0 ? 'F' : 'R'}${side(c.z)}`;

// ---- Classification ------------------------------------------------------------------------
const INTERIOR_MATS = new Set(['TMI_Cabin_A_008', 'TMI_Cabin_Leather_A_008', 'TMI_Cabin_Grid_A_003', 'TMI_Cabin_Grid_B_012', 'TMI_Dashboard_007', 'Mirror']);

const SYSTEM_OF: Record<string, VehicleSystem> = {};
const reg = (system: VehicleSystem, ...groups: string[]) => groups.forEach((g) => (SYSTEM_OF[g] = system));
reg('exterior', 'body_shell', 'windows', 'front_bumper', 'headlights', 'hood', 'engine_bay', 'door_FL', 'door_FR', 'door_RL', 'door_RR', 'mirror_L', 'mirror_R', 'roof', 'rear_bumper', 'taillights', 'tailgate', 'side_steps', 'wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR', 'headliner', 'cabin_trim');
reg('interior', 'steering_wheel', 'dashboard', 'instrument_cluster', 'infotainment', 'center_console', 'seat_FL', 'seat_FR', 'seat_R2', 'seat_R3', 'cabin_floor');
reg('suspension', 'frame', 'spare_wheel', 'front_suspension_L', 'front_suspension_R', 'rear_suspension_L', 'rear_suspension_R', 'control_arms_L', 'control_arms_R', 'springs_L', 'springs_R', 'steering', 'brake_FL', 'brake_FR', 'brake_RL', 'brake_RR');
reg('transmission', 'driveshaft', 'differentials', 'axles');

/** Cabin islands (seats, dash, console…) by position in vehicle space. */
function interiorGroup(i: Island, mat: string, key: string): string {
  const c = i.centre, s = i.box.getSize(new THREE.Vector3());
  if (key === 'SK_Body_Bones_101_001') return mat === 'TMI_Exhaust_030' ? 'dashboard' : 'steering_wheel';
  if (mat === 'TMI_Dashboard_007') return c.z < -0.25 ? 'instrument_cluster' : 'infotainment';
  if (c.y > 1.48 && (s.x > 0.5 || Math.abs(c.z) > 0.55)) return 'headliner';
  if (s.x > 1.2 || s.z > 1.3) {
    if (c.x > 0.2 && c.y > 0.9 && c.y < 1.4) return 'dashboard';
    return Math.abs(c.z) > 0.5 ? 'cabin_trim' : 'cabin_floor';
  }
  if (c.y > 1.45 && Math.abs(c.z) > 0.55) return 'cabin_trim';
  if (c.x > 0.45) return 'dashboard';
  if (Math.abs(c.z) < 0.25 && c.x > -0.65 && c.y < 1.3) return 'center_console';
  if (c.x > -0.65) return `seat_F${side(c.z)}`;
  if (c.x > -1.5) return 'seat_R2';
  if (c.x > -2.25) return 'seat_R3';
  return 'cabin_trim';
}

/** Chassis / drivetrain islands of the source's SK_Suspension node. */
function chassisGroup(i: Island): string {
  const c = i.centre, s = i.box.getSize(new THREE.Vector3());
  if (s.x > 3) return 'frame';
  if (c.x < -1.85) return 'spare_wheel';
  if (c.x < -0.95) {
    if (s.z > 1.0) return 'axles';
    if (Math.abs(c.z) < 0.2) return 'differentials';
    if (c.y > 0.5 || (s.x < 0.25 && s.z < 0.25 && Math.abs(c.z) > 0.3)) return `springs_${side(c.z)}`;
    return `rear_suspension_${side(c.z)}`;
  }
  if (c.x > 0.95) {
    if (c.y > 0.65) return `springs_${side(c.z)}`;
    if (s.z > 0.3 && s.x < 0.15) return 'steering';
    if (c.y < 0.45) return `control_arms_${side(c.z)}`;
    return `front_suspension_${side(c.z)}`;
  }
  if (s.x > 0.8 && Math.abs(c.z) < 0.3 && c.y < 0.45) return 'driveshaft';
  return 'frame';
}

function exteriorGroup(name: string, mat: string, c: THREE.Vector3): string {
  if (/Change_Brake/.test(name)) return `brake_${corner(c)}`;
  if (/rim:|^W\d_|^polySurface\d+_T:MI_Logo/.test(name)) return `wheel_${corner(c)}`;
  switch (keyOf(name)) {
    case 'SM_Body_101': return mat === 'TMI_Glass_011' ? 'windows' : 'body_shell';
    case 'SM_SideSkirts_101': return 'side_steps';
    case 'SM_Bumper_F_101': return 'front_bumper';
    case 'SM_Light_F_101': return 'headlights';
    case 'SK_Hood_101_001': return 'hood';
    case 'SM_Engine_101': return 'engine_bay';
    case 'SK_Door_FL_101_001': return 'door_FL';
    case 'SK_Door_FR_101_001': return 'door_FR';
    case 'SK_Door_BL_101_001': return 'door_RL';
    case 'SK_Door_BR_101_001': return 'door_RR';
    case 'SM_SideMirror_L_101': return 'mirror_L';
    case 'SM_SideMirror_R_101': return 'mirror_R';
    case 'SM_Roof_101': return 'roof';
    case 'SM_Bumper_B_101': case 'SM_Diffuser_B_101': case 'SK_Exhaust_101_001': return 'rear_bumper';
    case 'SM_Light_B_101': return 'taillights';
    case 'SK_Trunk_101_001': return 'tailgate';
    default: return 'body_shell';
  }
}

const ENGINE_GROUPS: [RegExp, string, boolean][] = [
  [/^Oil pan/, 'oil_pan', false], [/^crankshaft/, 'crankshaft', false], [/^Engine block/, 'engine_block', false],
  [/^pistons/, 'pistons', false], [/^engine cylinder head/, 'cylinder_head', true], [/^exhaust manifold/, 'exhaust', true],
  [/^intake manifold/, 'intake_system', false], [/^camshaft/, 'camshaft', false], [/^Rocker arm|^engine valve|^backing spring/, 'valvetrain', true],
  [/^valve cover/, 'valve_cover', true], [/^engine side cover/, 'timing_cover', false], [/^turbo/, 'turbo', true],
];

// ---- Assembly ------------------------------------------------------------------------------
interface Part { group: string; mesh: Mesh; matrix: THREE.Matrix4 }

function meshBox(mesh: Mesh, m: THREE.Matrix4) {
  const box = new THREE.Box3();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION')!;
    const min = pos.getMin([]), max = pos.getMax([]);
    for (let i = 0; i < 8; i++) box.expandByPoint(new THREE.Vector3(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).applyMatrix4(m));
  }
  return box;
}

/** Re-parent parts into <system> → <group (pivot at centre)> → mesh nodes, drop everything else. */
function assemble(doc: Document, system: VehicleSystem, parts: Part[], extras: Record<string, unknown>) {
  const root = doc.getRoot();
  const scene = doc.createScene(system);
  const sysNode = doc.createNode(system).setExtras({ system, ...extras });
  scene.addChild(sysNode);
  const boxes = new Map<string, THREE.Box3>();
  for (const p of parts) boxes.set(p.group, (boxes.get(p.group) ?? new THREE.Box3()).union(meshBox(p.mesh, p.matrix)));
  const groups = new Map<string, { node: Node; centre: THREE.Vector3 }>();
  for (const [g, b] of boxes) {
    const centre = b.getCenter(new THREE.Vector3());
    const node = doc.createNode(g).setTranslation(centre.toArray() as [number, number, number]);
    sysNode.addChild(node);
    groups.set(g, { node, centre });
  }
  parts.forEach((p, i) => {
    const g = groups.get(p.group)!;
    const local = new THREE.Matrix4().makeTranslation(-g.centre.x, -g.centre.y, -g.centre.z).multiply(p.matrix);
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    local.decompose(t, q, s);
    g.node.addChild(doc.createNode(`${p.group}_m${i}`).setMesh(p.mesh)
      .setTranslation(t.toArray() as [number, number, number]).setRotation(q.toArray() as [number, number, number, number]).setScale(s.toArray() as [number, number, number]));
  });
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  root.setDefaultScene(scene);
  const keep = new Set<Node>();
  sysNode.traverse((n) => keep.add(n));
  for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
}

const MATERIAL_RENAME: Record<string, string> = {
  TMI_1350010001_044: 'mat_body', rimMI_ChangeA_Rim_002: 'mat_rim', TMI_Exhaust_030: 'mat_trim',
  TMI_Cabin_Leather_A_008: 'mat_seat', TMI_Cabin_A_008: 'mat_interior', TMI_Dashboard_007: 'mat_dash_finish',
  TMI_Cabin_Grid_A_003: 'mat_interior_trim', TMI_Glass_011: 'mat_glass',
};
function fixMaterials(doc: Document) {
  for (const m of doc.getRoot().listMaterials()) {
    const r = MATERIAL_RENAME[m.getName()];
    if (r) m.setName(r);
    if (m.getAlphaMode() === 'BLEND' && !/glass|Glass|phong1|Light/.test(m.getName())) m.setAlphaMode('MASK').setAlphaCutoff(0.5);
  }
}

/** Write main (+ optional LOD) GLB, Draco-compressed. Materials are never deduplicated (configurable groups). */
async function finish(doc: Document, system: VehicleSystem, opts: { ratio?: number; lodRatio?: number }) {
  doc.getRoot().getAsset().generator = 'auto-showroom import-lc300';
  await doc.transform(unpartition(), prune({ keepLeaves: false }), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), weld());
  if (opts.ratio) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: opts.ratio, error: 0.0008 }));
  await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const file = path.join(OUT, system, `eval-${system}.glb`);
  const bin = await io.writeBinary(doc);
  await writeFile(file, bin);
  let lod: { bytes: number } | undefined;
  if (opts.lodRatio) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: opts.lodRatio, error: 0.004 }));
    const lb = await io.writeBinary(doc);
    await writeFile(path.join(OUT, system, `eval-${system}-lod.glb`), lb);
    lod = { bytes: lb.byteLength };
  }
  const groups = doc.getRoot().getDefaultScene()!.listChildren()[0]!.listChildren().map((n) => n.getName());
  console.log(`${system.padEnd(13)} ${(bin.byteLength / 1048576).toFixed(2)} MB${lod ? ` (LOD ${(lod.bytes / 1048576).toFixed(2)} MB)` : ''}  groups: ${groups.join(', ')}`);
  return { bytes: bin.byteLength, lod, doc };
}

/** Collect parts for one system from the LC300 source, splitting merged meshes into islands where needed. */
async function carParts(system: VehicleSystem) {
  const doc = await io.read(CAR);
  const parts: Part[] = [];
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    const name = n.getName(), key = keyOf(name);
    const m = CAR_TO_VEHICLE.clone().multiply(world(n));
    const mat = mesh.listPrimitives()[0]?.getMaterial()?.getName() ?? '';
    let split: Map<string, Mesh> | null = null;
    if (key === 'SK_Suspension_101_001') split = splitMesh(doc, n, m, (i) => chassisGroup(i));
    else if (key === 'SK_Body_Bones_101_001' || (key === 'SM_Body_101' && INTERIOR_MATS.has(mat))) split = splitMesh(doc, n, m, (i, mt) => interiorGroup(i, mt, key));
    if (split) {
      for (const [g, sm] of split) if (SYSTEM_OF[g] === system) parts.push({ group: g, mesh: sm, matrix: m });
      continue;
    }
    const g = exteriorGroup(name, mat, meshBox(mesh, m).getCenter(new THREE.Vector3()));
    if (SYSTEM_OF[g] === system) parts.push({ group: g, mesh, matrix: m });
  }
  return { doc, parts };
}

async function buildCarSystem(system: VehicleSystem, opts: { ratio?: number; lodRatio?: number }, extra?: (doc: Document) => Promise<void>) {
  const { doc, parts } = await carParts(system);
  assemble(doc, system, parts, { evaluation: true, disclaimer: DISCLAIMER, source: CREDIT_CAR });
  fixMaterials(doc);
  if (system === 'exterior') {
    // Roof gets its own copy of the paint so it can be coloured independently.
    const roof = doc.getRoot().listNodes().find((n) => n.getName() === 'roof');
    let roofMat: ReturnType<typeof doc.createMaterial> | null = null;
    roof?.traverse((n) => n.getMesh()?.listPrimitives().forEach((p) => {
      if (p.getMaterial()?.getName() !== 'mat_body') return;
      roofMat ??= p.getMaterial()!.clone().setName('mat_roof');
      p.setMaterial(roofMat);
    }));
  }
  if (extra) await extra(doc);
  return finish(doc, system, opts);
}

async function buildEngine() {
  const doc = await io.read(ENGINE);
  const top = doc.getRoot().listNodes().find((n) => n.getName() === 'Car engine DONE v5')!;
  const parts: Part[] = [];
  for (const child of top.listChildren()) {
    const rule = ENGINE_GROUPS.find(([re]) => re.test(child.getName()));
    if (!rule) { console.warn('engine: unmapped', child.getName()); continue; }
    const [, group, sided] = rule;
    child.traverse((n) => {
      if (!n.getMesh()) return;
      const m = ENGINE_TO_VEHICLE.clone().multiply(world(n));
      if (!sided) { parts.push({ group, mesh: n.getMesh()!, matrix: m }); return; }
      for (const [g, sm] of splitMesh(doc, n, m, (i) => `${group}_${side(i.centre.z)}`)) parts.push({ group: g, mesh: sm, matrix: m });
    });
  }
  assemble(doc, 'engine', parts, { illustrative: true, note: NOTE_ENGINE, source: CREDIT_ENGINE });
  return finish(doc, 'engine', { ratio: 0.3, lodRatio: 0.35 });
}

/** Copy every mesh of an external CAD model into `doc` under a new group, placed with `matrices` (one per instance). */
async function insertModel(doc: Document, file: string, group: string, matrices: THREE.Matrix4[], skip: RegExp | null, extras: Record<string, unknown>) {
  const src = await io.read(file);
  const parts: { mesh: Mesh; world: THREE.Matrix4 }[] = [];
  for (const n of src.getRoot().listNodes()) if (n.getMesh() && !(skip && skip.test(n.getName()))) parts.push({ mesh: n.getMesh()!, world: world(n) });
  const box = new THREE.Box3();
  for (const p of parts) box.union(meshBox(p.mesh, p.world));
  const centre = box.getCenter(new THREE.Vector3());
  // Tag source meshes so we can find them after the merge.
  for (const p of parts) p.mesh.setExtras({ __insert: group });
  const map = mergeDocuments(doc, src);
  const sys = doc.getRoot().getDefaultScene()!.listChildren()[0]!;
  for (const s of doc.getRoot().listScenes()) if (s !== doc.getRoot().getDefaultScene()) s.dispose();
  const g = doc.createNode(group).setExtras(extras);
  const anchor = new THREE.Vector3(0, 0, 0).applyMatrix4(matrices[0]!.clone().multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)));
  void anchor;
  const groupCentre = new THREE.Vector3();
  for (const m of matrices) groupCentre.add(new THREE.Vector3().setFromMatrixPosition(m));
  groupCentre.divideScalar(matrices.length);
  g.setTranslation(groupCentre.toArray() as [number, number, number]);
  sys.addChild(g);
  matrices.forEach((m, k) => parts.forEach((p, i) => {
    const mesh = map.get(p.mesh) as Mesh;
    const local = new THREE.Matrix4().makeTranslation(-groupCentre.x, -groupCentre.y, -groupCentre.z).multiply(m).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)).multiply(p.world);
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    local.decompose(t, q, sc);
    g.addChild(doc.createNode(`${group}_${k}_${i}`).setMesh(mesh).setTranslation(t.toArray() as [number, number, number]).setRotation(q.toArray() as [number, number, number, number]).setScale(sc.toArray() as [number, number, number]));
  }));
  // Orphaned nodes from the merged scene.
  const keep = new Set<Node>();
  sys.traverse((n) => keep.add(n));
  for (const n of doc.getRoot().listNodes()) if (!keep.has(n)) n.dispose();
}

/** Real CAD gear sets placed inside the gearbox housing and the rear differential. */
async function realGears(doc: Document) {
  // Planetary reducer: axis along source Z, Ø 0.185 → Ø 0.22 m; three sets along the gearbox axis.
  const s = 0.22 / 0.185;
  const rot = new THREE.Matrix4().makeRotationY(Math.PI / 2); // source Z → vehicle X
  const sets = [0.5, 0.67, 0.84].map((x) => new THREE.Matrix4().makeTranslation(x, 0.585 - (x - 0.66) * 0.08, 0).multiply(rot).multiply(new THREE.Matrix4().makeScale(s, s, s)));
  await insertModel(doc, PLANETARY, 'planetary_gearset', sets, null, { source: CREDIT_PLANETARY });
  // Hypoid ring & pinion: ring axis = source Y → vehicle Z (lateral), pinion along +X (forward). Ring Ø 0.86 → 0.24 m.
  const h = 0.24 / 0.86;
  const hyp = new THREE.Matrix4().makeTranslation(-1.43, 0.4, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(h, h, h));
  await insertModel(doc, HYPOID, 'ring_and_pinion', [hyp], /axis/i, { source: CREDIT_HYPOID });
}

/** Gearbox, torque converter and transfer case don't exist in any source — simple labelled stand-ins. */
async function demoDrivetrain(doc: Document) {
  const mat = new THREE.MeshStandardMaterial({ name: 'demo_cast_alloy', color: '#8e9196', metalness: 0.85, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ name: 'demo_cast_dark', color: '#3a3c40', metalness: 0.6, roughness: 0.5 });
  const g = (name: string, centre: [number, number, number], ...meshes: THREE.Mesh[]) => { const o = new THREE.Group(); o.name = name; o.position.set(...centre); meshes.forEach((m) => o.add(m)); return o; };
  const cylX = (r1: number, r2: number, len: number, m: THREE.Material) => { const geo = new THREE.CylinderGeometry(r2, r1, len, 40); geo.rotateZ(-Math.PI / 2); return new THREE.Mesh(geo, m); };
  const root = new THREE.Group();
  root.add(g('torque_converter', [1.0, 0.62, 0], cylX(0.2, 0.17, 0.16, mat)));
  const gb = cylX(0.16, 0.11, 0.56, mat); gb.rotation.z = 0.08;
  root.add(g('gearbox', [0.66, 0.58, 0], gb));
  root.add(g('transfer_case', [0.26, 0.47, 0.02], new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), dark)));
  const demo = await threeToDocument(io, root);
  mergeDocuments(doc, demo);
  const main = doc.getRoot().getDefaultScene()!;
  const sys = main.listChildren()[0]!;
  for (const s of doc.getRoot().listScenes()) {
    if (s === main) continue;
    // three's exporter wraps everything in one top-level group; lift its children (the named groups).
    for (const top of s.listChildren()) for (const n of [...top.listChildren()]) { n.setExtras({ demonstration: true }); sys.addChild(n); }
    s.dispose();
  }
}

// ---- Run -----------------------------------------------------------------------------------
const ext = await buildCarSystem('exterior', { lodRatio: 0.3 });
const int = await buildCarSystem('interior', { lodRatio: 0.35 });
const sus = await buildCarSystem('suspension', {});
const trn = await buildCarSystem('transmission', {}, async (doc) => { await demoDrivetrain(doc); await realGears(doc); });
const eng = await buildEngine();

// ---- Manifest ------------------------------------------------------------------------------
const four = (p: string) => ['FL', 'FR', 'RL', 'RR'].map((c) => `${p}_${c}`);
const pair = (p: string) => [`${p}_L`, `${p}_R`];
type V3 = [number, number, number];
const C = (id: string, system: VehicleSystem, nodes: string[], note: string, offset?: V3, delay = 0, mirror = false, rotation: V3 = [0, 0, 0]): ComponentMapping =>
  ({ id, system, nodes, note, ...(offset ? { explode: { offset, rotation, delay, mirror } } : {}) });

const components: ComponentMapping[] = [
  // Exterior (real)
  C('body_shell', 'exterior', ['body_shell'], NOTE_CAR),
  C('front_bumper', 'exterior', ['front_bumper'], NOTE_CAR, [0.95, -0.05, 0]),
  C('headlights', 'exterior', ['headlights'], NOTE_CAR, [0.6, 0.1, 0], 0.15),
  C('hood', 'exterior', ['hood'], NOTE_CAR, [0.15, 0.95, 0], 0.05, false, [0, 0, 0.3]),
  C('doors', 'exterior', four('door'), NOTE_CAR, [0, 0.04, 0.85], 0.2, true),
  C('mirrors', 'exterior', pair('mirror'), NOTE_CAR, [0.05, 0.18, 1.1], 0.25, true),
  C('wheels', 'exterior', four('wheel'), NOTE_CAR, [0, 0, 1.0], 0.3, true),
  C('windows', 'exterior', ['windows'], NOTE_CAR, [0, 0.55, 0], 0.35),
  C('roof', 'exterior', ['roof'], NOTE_CAR, [0, 1.05, 0], 0.4),
  C('rear_bumper', 'exterior', ['rear_bumper'], NOTE_CAR, [-0.95, -0.05, 0]),
  C('taillights', 'exterior', ['taillights'], NOTE_CAR, [-0.6, 0.1, 0], 0.15),
  C('tailgate', 'exterior', ['tailgate'], NOTE_CAR, [-0.75, 0.35, 0], 0.1, false, [0, 0, -0.25]),
  C('side_steps', 'exterior', ['side_steps'], NOTE_CAR, [0, -0.25, 0], 0.3),
  // Interior (real, split from merged meshes)
  C('dashboard', 'interior', ['dashboard'], NOTE_CAR, [0.55, 0.1, 0]),
  C('instrument_cluster', 'interior', ['instrument_cluster'], NOTE_CAR, [0.35, 0.4, 0], 0.1),
  C('infotainment', 'interior', ['infotainment'], NOTE_CAR, [0.4, 0.55, 0], 0.1),
  C('steering_wheel', 'interior', ['steering_wheel'], NOTE_CAR, [-0.4, 0.3, 0], 0.2),
  C('center_console', 'interior', ['center_console'], NOTE_CAR, [0, 0.5, 0], 0.15),
  C('seats', 'interior', ['seat_FL', 'seat_FR', 'seat_R2', 'seat_R3'], NOTE_CAR, [0, 0.7, 0.35], 0.25, true),
  // Engine (illustrative V6)
  C('engine_block', 'engine', ['engine_block'], NOTE_ENGINE),
  C('oil_pan', 'engine', ['oil_pan'], NOTE_ENGINE, [0, -0.5, 0]),
  C('crankshaft', 'engine', ['crankshaft'], NOTE_ENGINE, [0, -0.28, 0], 0.1),
  C('pistons', 'engine', ['pistons'], NOTE_ENGINE, [0, 0.85, 0], 0.25),
  C('cylinder_heads', 'engine', pair('cylinder_head'), NOTE_ENGINE, [0, 0.3, 0.4], 0.05, true),
  C('valve_covers', 'engine', pair('valve_cover'), NOTE_ENGINE, [0, 0.6, 0.55], 0, true),
  C('valvetrain', 'engine', pair('valvetrain'), NOTE_ENGINE, [0, 0.45, 0.48], 0.1, true),
  C('camshaft', 'engine', ['camshaft'], NOTE_ENGINE, [0, 0.62, 0], 0.15),
  C('intake_system', 'engine', ['intake_system'], NOTE_ENGINE, [0, 1.0, 0], 0.2),
  C('exhaust_system', 'engine', pair('exhaust'), NOTE_ENGINE, [0, -0.1, 0.7], 0.1, true),
  C('turbochargers', 'engine', pair('turbo'), NOTE_ENGINE, [-0.15, 0.2, 0.85], 0.15, true),
  C('timing_cover', 'engine', ['timing_cover'], NOTE_ENGINE, [0.55, 0, 0]),
  // Drivetrain
  C('torque_converter', 'transmission', ['torque_converter'], NOTE_DEMO, [0.3, 0.25, 0]),
  C('gearbox', 'transmission', ['gearbox'], NOTE_DEMO, [0, 0.45, 0], 0.05),
  C('planetary_gearset', 'transmission', ['planetary_gearset'], NOTE_PLANETARY, [0, -0.3, 0.6], 0.15),
  C('ring_and_pinion', 'transmission', ['ring_and_pinion'], NOTE_HYPOID, [0.15, 0.6, 0.45], 0.3),
  C('transfer_case', 'transmission', ['transfer_case'], NOTE_DEMO, [0, 0.2, 0.5], 0.1),
  C('driveshaft', 'transmission', ['driveshaft'], NOTE_CAR, [0, -0.3, 0], 0.15),
  C('differentials', 'transmission', ['differentials'], NOTE_CAR, [-0.35, 0.35, 0], 0.2),
  C('axles', 'transmission', ['axles'], NOTE_CAR, [0, -0.25, 0], 0.25),
  // Chassis
  C('frame', 'suspension', ['frame'], NOTE_CAR),
  C('front_suspension', 'suspension', pair('front_suspension'), NOTE_CAR, [0.2, 0.05, 0.55], 0.1, true),
  C('rear_suspension', 'suspension', pair('rear_suspension'), NOTE_CAR, [-0.3, 0, 0.35], 0.1, true),
  C('control_arms', 'suspension', pair('control_arms'), NOTE_CAR, [0.15, -0.12, 0.45], 0.15, true),
  C('springs', 'suspension', pair('springs'), NOTE_CAR, [0, 0.6, 0.3], 0.2, true),
  C('braking_system', 'suspension', four('brake'), NOTE_CAR, [0, 0, 0.55], 0.05, true),
  C('steering', 'suspension', ['steering'], NOTE_CAR, [0.45, 0.15, 0], 0.1),
];

const ALL = { exterior: 1, interior: 1, suspension: 1, transmission: 1, engine: 0 };
const Z = { exterior: 0, interior: 0, suspension: 0, transmission: 0, engine: 0 };
const kf = (at: number, position: V3, target: V3, explode: Partial<typeof Z>, opacity: Partial<typeof Z>, fov = 32): Keyframe =>
  ({ at, camera: { position, target, fov }, explode: { ...Z, ...explode }, opacity: { ...Z, ...opacity }, yaw: 0 });
const keyframes: Keyframe[] = [
  kf(0, [7.2, 2.0, 6.4], [0, 0.85, 0], {}, ALL),
  kf(0.5, [-3.2, 1.5, 7.4], [0, 0.9, 0], {}, ALL),
  kf(0.92, [5.4, 1.2, -3.8], [1.1, 0.85, 0], {}, ALL),
  kf(1.15, [8.6, 4.3, 7.6], [0, 0.9, 0], {}, ALL, 34),
  kf(1.85, [8.2, 4.2, 8.6], [0, 0.95, 0], { exterior: 1 }, ALL, 34),
  kf(2.12, [4.0, 1.9, 2.9], [1.55, 0.85, 0], {}, { exterior: 0.025, engine: 1 }, 30),
  kf(2.85, [4.1, 2.6, 3.4], [1.55, 1.05, 0], { engine: 1 }, { exterior: 0.02, engine: 1 }, 34),
  kf(3.12, [0.9, 1.2, 3.6], [0.3, 0.5, 0], {}, { exterior: 0.025, engine: 0.35, transmission: 1, suspension: 0.15 }),
  kf(3.85, [0.4, 1.7, 3.9], [0.2, 0.55, 0], { transmission: 1 }, { exterior: 0.02, engine: 0.25, transmission: 1, suspension: 0.1 }),
  kf(4.12, [4.4, 1.4, 3.9], [0.6, 0.45, 0], {}, { exterior: 0.025, suspension: 1, transmission: 0.3, engine: 0.2 }),
  kf(4.85, [5.2, 2.5, 4.9], [0.4, 0.55, 0], { suspension: 1 }, { exterior: 0.02, suspension: 1, transmission: 0.2, engine: 0.15 }),
  kf(5.15, [-0.12, 1.38, 0.02], [0.9, 1.15, -0.2], {}, { exterior: 0.12, interior: 1 }, 62),
  kf(5.5, [-0.05, 1.36, 0.08], [0.9, 1.12, 0.15], {}, { exterior: 0.12, interior: 1 }, 62),
  kf(5.88, [3.2, 3.4, 3.6], [-0.3, 1.0, 0], { interior: 1 }, { exterior: 0.04, interior: 1 }, 36),
  kf(6.2, [7.6, 1.7, -5.4], [0, 0.85, 0], {}, ALL),
  kf(7, [6.8, 2.1, 6.1], [0, 0.85, 0], {}, ALL),
];

const demo = buildManifest('land-cruiser-300', {});
const paint = ext.doc.getRoot().listMaterials().find((m) => m.getName() === 'mat_body')?.getBaseColorFactor() ?? [0.88, 0.87, 0.81];
const hex = (lin: number[]) => '#' + lin.slice(0, 3).map((c) => Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
const W = '#ffffff';
const asset = (s: string, r: { bytes: number; lod?: { bytes: number } }) => ({ url: `${s}/eval-${s}.glb`, draco: true, ktx2: false, bytes: r.bytes, ...(r.lod ? { lodUrl: `${s}/eval-${s}-lod.glb` } : {}) });
const REQUIRES: Record<string, VehicleSystem[]> = {
  exterior: ['exterior', 'interior', 'suspension'], exploded: ['exterior', 'interior', 'suspension', 'transmission'], engine: ['engine'],
  transmission: ['transmission', 'engine'], suspension: ['suspension'], interior: ['interior'], final: ['exterior', 'interior', 'suspension', 'transmission'],
};
const manifest = VehicleManifest.parse({
  ...demo,
  assetStatus: 'evaluation',
  disclaimer: DISCLAIMER,
  assets: { exterior: asset('exterior', ext), interior: asset('interior', int), engine: asset('engine', eng), transmission: asset('transmission', trn), suspension: asset('suspension', sus) },
  materialGroups: [
    { id: 'body', label: 'Их биеийн өнгө', materials: ['mat_body'], surface: 'exterior', default: { hex: hex(paint), metalness: 0.5, roughness: 0.3, clearcoat: 1 } },
    { id: 'roof', label: 'Дээврийн өнгө', materials: ['mat_roof'], surface: 'exterior', default: { hex: hex(paint), metalness: 0.5, roughness: 0.3, clearcoat: 1 } },
    { id: 'wheels', label: 'Обудны өнгө', materials: ['mat_rim'], surface: 'exterior', default: { hex: W, metalness: 0.9, roughness: 0.3, clearcoat: 0 } },
    { id: 'exterior_trim', label: 'Гадна чимэглэл', materials: ['mat_trim'], surface: 'exterior', default: { hex: W, metalness: 0.2, roughness: 0.6, clearcoat: 0 } },
    { id: 'seats', label: 'Суудлын арьс', materials: ['mat_seat'], surface: 'interior', default: { hex: W, metalness: 0, roughness: 0.6, clearcoat: 0 } },
    { id: 'interior_material', label: 'Дотор засал', materials: ['mat_interior'], surface: 'interior', default: { hex: W, metalness: 0.05, roughness: 0.7, clearcoat: 0 } },
    { id: 'dashboard_finish', label: 'Хянах самбарын өнгөлгөө', materials: ['mat_dash_finish'], surface: 'interior', default: { hex: W, metalness: 0.1, roughness: 0.5, clearcoat: 0 } },
    { id: 'interior_trim', label: 'Дотор чимэглэл', materials: ['mat_interior_trim'], surface: 'interior', default: { hex: W, metalness: 0.5, roughness: 0.4, clearcoat: 0 } },
  ],
  switches: [],
  components,
  story: { sections: demo.story.sections.map((s) => ({ ...s, requires: REQUIRES[s.id] ?? s.requires })), keyframes },
  hero: { position: [7.4, 1.25, 6.6], target: [0, 0.05, 0], fov: 30 },
  configurator: { position: [6.2, 1.9, 6.0], target: [0, 0.8, 0], fov: 30 },
  cameras: { interior: { position: [-0.1, 1.4, 0.02], target: [0.9, 1.15, -0.2], fov: 64 } },
  cabin: { min: [-2.3, 0.6, -0.85], max: [1.0, 1.85, 0.85] },
  credits: [CREDIT_CAR, CREDIT_ENGINE, CREDIT_PLANETARY, CREDIT_HYPOID, 'Хурдны хайрцаг, момент хувиргагч, хуваарилах хайрцаг: үзүүлэн геометр (энэ төсөл).'],
});
const problems = lintManifest(manifest);
if (problems.length) throw new Error(problems.join('\n'));
await writeFile(path.join(OUT, 'vehicle.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${manifest.components.length} components`);
