/**
 * Generic importer for third-party whole-vehicle models (exterior + cabin as one asset).
 * Normalises orientation/scale, identifies the body paint material, splits wheels / glass / lights
 * into selectable components, simplifies, Draco-compresses and writes a "showcase" manifest
 * (exterior, exploded wheels/glass, cabin view, configurator).
 *
 * Usage: npx tsx scripts/import-showcase.ts <id>     (ids defined in SHOWCASE below)
 */
import { NodeIO, PropertyType, type Document, type Mesh, type Node, type Material } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, simplify, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lintManifest, VehicleManifest, type ComponentMapping, type Keyframe } from '../packages/shared/src/index';

interface Showcase { id: string; dir: string; slug: string; length: number; width: number; height: number; credit: string; licence: string; paint?: RegExp | null; roof?: RegExp }
export const SHOWCASE: Record<string, Showcase> = {
  lx600: { id: 'lx600', dir: 'lexus/lx-600', slug: 'lx-600', length: 5.1, width: 1.99, height: 1.885, licence: 'CC BY 4.0', paint: /^(paint|car_paint)$/, credit: '“LEXUS LX 600” by KINGSLEY_king, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/3780684a306b4549af6a258036d7ab27' },
  t2: { id: 't2', dir: 'jetour/t2', slug: 't2', length: 4.785, width: 2.006, height: 1.88, licence: 'CC BY 4.0', credit: '“Jetour T2” by Uzbek3D, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/75eb2bdf00a14fe3b6a0900ca62829ae' },
  dashing: { id: 'dashing', dir: 'jetour/dashing', slug: 'dashing', length: 4.59, width: 1.9, height: 1.685, licence: 'CC BY 4.0', paint: /PAINT_1$/, credit: '“Jetour Dashing” by Uzbek3D, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/a8cd6bc24cbf44fc951631078caaffde' },
  lc250: { id: 'lc250', dir: 'toyota/land-cruiser-250', slug: 'land-cruiser-250', length: 4.925, width: 1.98, height: 1.935, licence: 'CC BY-NC-SA 4.0', paint: /^CarPaint$/, roof: /^CarPaint_N2$/, credit: '“2025 Toyota Land Cruiser 250” by ddiaz-design, Sketchfab, CC BY-NC-SA 4.0 — https://sketchfab.com/3d-models/b53e78d5e3474474a788e7ef4deccda0' },
  gx550: { id: 'gx550', dir: 'lexus/gx-550', slug: 'gx-550', length: 4.96, width: 1.98, height: 1.92, licence: 'CC BY-NC-SA 4.0', credit: '“2023 Lexus GX 550 h Overtrail” by ddiaz-design, Sketchfab, CC BY-NC-SA 4.0 — https://sketchfab.com/3d-models/2c8aadc8d0ea4ec180f758cd1361254b' },
  songplus: { id: 'songplus', dir: 'byd/song-plus', slug: 'song-plus', length: 4.775, width: 1.89, height: 1.67, licence: 'CC BY 4.0', paint: null, credit: '“2023 BYD Song Plus” by NazhDesign, Sketchfab, CC BY 4.0 — https://sketchfab.com/3d-models/46546075cf4a40d4b75f010685168b9f' },
};

const TARGET_TRIS = 350_000;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;

const world = (n: Node) => new THREE.Matrix4().fromArray(n.getWorldMatrix() as unknown as number[]);
const tris = (m: Mesh) => m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0);

/** Sample vertex positions (world space) of every mesh node. */
function samplePoints(doc: Document, stride = 23) {
  const pts: THREE.Vector3[] = [];
  const el: number[] = [];
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const w = world(n);
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')!;
      for (let i = 0; i < pos.getCount(); i += stride) { pos.getElement(i, el); pts.push(new THREE.Vector3(el[0], el[1], el[2]).applyMatrix4(w)); }
    }
  }
  return pts;
}

/** Orientation: longest horizontal axis = length; the end with the lower top (hood) is the front. */
function normaliser(doc: Document, cfg: Showcase) {
  const pts = samplePoints(doc);
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  const up = size.y < Math.max(size.x, size.z) ? 'y' : size.z < size.x ? 'z' : 'x';
  const upFix = up === 'y' ? new THREE.Matrix4() : up === 'z' ? new THREE.Matrix4().makeRotationX(-Math.PI / 2) : new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const p1 = pts.map((p) => p.clone().applyMatrix4(upFix));
  const b1 = new THREE.Box3().setFromPoints(p1), s1 = b1.getSize(new THREE.Vector3());
  const lenAxis = s1.x >= s1.z ? 'x' : 'z';
  const toX = lenAxis === 'x' ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationY(Math.PI / 2); // z → x
  const p2 = p1.map((p) => p.clone().applyMatrix4(toX));
  const b2 = new THREE.Box3().setFromPoints(p2), s2 = b2.getSize(new THREE.Vector3());
  const endTop = (lo: number, hi: number) => {
    const ys = p2.filter((p) => p.x >= lo && p.x <= hi).map((p) => p.y).sort((a, b) => a - b);
    return ys.length ? ys[Math.floor(ys.length * 0.98)]! : 0;
  };
  const seg = s2.x * 0.18;
  const topMaxX = endTop(b2.max.x - seg, b2.max.x), topMinX = endTop(b2.min.x, b2.min.x + seg);
  const flip = topMaxX > topMinX ? new THREE.Matrix4().makeRotationY(Math.PI) : new THREE.Matrix4(); // lower end must be +X
  const p3 = p2.map((p) => p.clone().applyMatrix4(flip));
  const b3 = new THREE.Box3().setFromPoints(p3), s3 = b3.getSize(new THREE.Vector3());
  const scale = cfg.length / s3.x;
  const c3 = b3.getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-c3.x, -b3.min.y, -c3.z)).multiply(flip).multiply(toX).multiply(upFix);
  console.log(`  up=${up} length=${lenAxis} flip=${topMaxX > topMinX} scale=${scale.toFixed(4)} → ${(s3.x * scale).toFixed(2)} × ${(s3.y * scale).toFixed(2)} × ${(s3.z * scale).toFixed(2)} m (official ${cfg.length} × ${cfg.height} × ${cfg.width})`);
  return m;
}

/** Linear glTF colour → sRGB hex. */
const srgbHex = (lin: number[]) => '#' + lin.slice(0, 3).map((c) => Math.round(Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)) * 255).toString(16).padStart(2, '0')).join('');

const RE = {
  wheel: /wheel|tire|tyre|rim|brake|caliper|disc|hub|koleso|shina|disk/i,
  glass: /glass|window|windshield|windscreen|steklo/i,
  light: /light|lamp|head.?l|tail.?l|fara|led|drl|indicator/i,
};

/** Area of a primitive in world units (sampled) — used to find the dominant body paint. */
function primArea(p: ReturnType<Mesh['listPrimitives']>[number], m: THREE.Matrix4) {
  const pos = p.getAttribute('POSITION')!, idx = p.getIndices();
  const n = idx ? idx.getCount() : pos.getCount();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), el: number[] = [];
  let area = 0, k = 0;
  const step = Math.max(3, Math.floor(n / 3 / 400) * 3);
  for (let t = 0; t + 2 < n; t += step) {
    const i0 = idx ? idx.getScalar(t) : t, i1 = idx ? idx.getScalar(t + 1) : t + 1, i2 = idx ? idx.getScalar(t + 2) : t + 2;
    pos.getElement(i0, el); a.set(el[0]!, el[1]!, el[2]!).applyMatrix4(m);
    pos.getElement(i1, el); b.set(el[0]!, el[1]!, el[2]!).applyMatrix4(m);
    pos.getElement(i2, el); c.set(el[0]!, el[1]!, el[2]!).applyMatrix4(m);
    area += b.sub(a).cross(c.sub(a)).length() / 2; k++;
  }
  return k ? (area * n) / 3 / k : 0;
}

function findPaint(doc: Document, norm: THREE.Matrix4, cfg: Showcase): Material[] {
  if (cfg.paint === null) return [];
  const mats = doc.getRoot().listMaterials();
  const byName = mats.filter((m) => (cfg.paint ?? /car.?paint|body.?paint|^paint|body_?col|exterior.?paint|kuzov/i).test(m.getName()));
  if (byName.length) return byName;
  const area = new Map<Material, number>();
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const w = norm.clone().multiply(world(n));
    for (const p of mesh.listPrimitives()) {
      const mt = p.getMaterial(); if (!mt) continue;
      area.set(mt, (area.get(mt) ?? 0) + primArea(p, w));
    }
  }
  const candidates = [...area.entries()].filter(([m]) => m.getAlphaMode() === 'OPAQUE' && !RE.glass.test(m.getName()) && !RE.wheel.test(m.getName()) && !RE.light.test(m.getName()))
    .filter(([m]) => { const c = m.getBaseColorFactor(); return Math.max(c[0]!, c[1]!, c[2]!) > 0.08 || !!m.getBaseColorTexture(); })
    .sort((a, b) => b[1] - a[1]);
  return candidates[0] ? [candidates[0][0]] : [];
}

function classify(n: Node, mat: string, c: THREE.Vector3, cfg: Showcase): string {
  const name = `${n.getName()} ${n.getParentNode()?.getName() ?? ''} ${mat}`;
  if (RE.wheel.test(name) && c.y < cfg.height * 0.42) return `wheel_${c.x > 0 ? 'F' : 'R'}${c.z < 0 ? 'L' : 'R'}`;
  if (RE.glass.test(name)) return 'windows';
  if (RE.light.test(name)) return c.x > 0 ? 'headlights' : 'taillights';
  return 'body_shell';
}

function meshBox(mesh: Mesh, m: THREE.Matrix4) {
  const box = new THREE.Box3();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION')!;
    const min = pos.getMin([]), max = pos.getMax([]);
    for (let i = 0; i < 8; i++) box.expandByPoint(new THREE.Vector3(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).applyMatrix4(m));
  }
  return box;
}

async function run(cfg: Showcase) {
  console.log(`== ${cfg.id}`);
  const doc = await io.read(`incoming/${cfg.id}/model.glb`);
  const root = doc.getRoot();
  const norm = normaliser(doc, cfg);
  const paintMats = findPaint(doc, norm, cfg);
  const roofMats = cfg.roof ? root.listMaterials().filter((m) => cfg.roof!.test(m.getName())) : [];
  console.log(`  paint: ${paintMats.map((m) => m.getName()).join(', ') || '(none)'}${roofMats.length ? `  roof: ${roofMats.map((m) => m.getName()).join(', ')}` : ''}`);
  // Vertex-coloured paint: fold the average vertex colour into the material so recolouring is exact.
  const defaults = new Map<string, string>();
  for (const [mats, name] of [[paintMats, 'mat_body'], [roofMats, 'mat_roof']] as const) {
    let hex = '#ffffff';
    for (const m of mats) {
      const sum = [0, 0, 0]; let n = 0; const el: number[] = [];
      for (const prim of root.listMeshes().flatMap((me) => me.listPrimitives()).filter((p) => p.getMaterial() === m)) {
        const col = prim.getAttribute('COLOR_0');
        if (!col) continue;
        for (let i = 0; i < col.getCount(); i += 5) { col.getElement(i, el); sum[0] += el[0]!; sum[1] += el[1]!; sum[2] += el[2]!; n++; }
        prim.setAttribute('COLOR_0', null);
      }
      const f = m.getBaseColorFactor();
      if (n) m.setBaseColorFactor([f[0]! * sum[0]! / n, f[1]! * sum[1]! / n, f[2]! * sum[2]! / n, f[3]!]);
      m.setName(name);
      if (!m.getBaseColorTexture()) hex = srgbHex(m.getBaseColorFactor());
    }
    defaults.set(name, hex);
  }
  for (const m of root.listMaterials()) if (m.getAlphaMode() === 'BLEND' && !RE.glass.test(m.getName()) && !RE.light.test(m.getName()) && m.getBaseColorFactor()[3]! > 0.95) m.setAlphaMode('MASK').setAlphaCutoff(0.5);

  // Regroup.
  const parts: { group: string; mesh: Mesh; m: THREE.Matrix4 }[] = [];
  for (const n of root.listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const m = norm.clone().multiply(world(n));
    const mat = mesh.listPrimitives()[0]?.getMaterial()?.getName() ?? '';
    parts.push({ group: classify(n, mat, meshBox(mesh, m).getCenter(new THREE.Vector3()), cfg), mesh, m });
  }
  const scene = doc.createScene('exterior');
  const sys = doc.createNode('exterior').setExtras({ evaluation: true, source: cfg.credit });
  scene.addChild(sys);
  const boxes = new Map<string, THREE.Box3>();
  for (const p of parts) boxes.set(p.group, (boxes.get(p.group) ?? new THREE.Box3()).union(meshBox(p.mesh, p.m)));
  const groups = new Map<string, { node: Node; c: THREE.Vector3 }>();
  for (const [g, b] of boxes) { const c = b.getCenter(new THREE.Vector3()); const node = doc.createNode(g).setTranslation(c.toArray() as [number, number, number]); sys.addChild(node); groups.set(g, { node, c }); }
  parts.forEach((p, i) => {
    const g = groups.get(p.group)!;
    const local = new THREE.Matrix4().makeTranslation(-g.c.x, -g.c.y, -g.c.z).multiply(p.m);
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    local.decompose(t, q, s);
    g.node.addChild(doc.createNode(`${p.group}_m${i}`).setMesh(p.mesh).setTranslation(t.toArray() as [number, number, number]).setRotation(q.toArray() as [number, number, number, number]).setScale(s.toArray() as [number, number, number]));
  });
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  root.setDefaultScene(scene);
  const keep = new Set<Node>(); sys.traverse((n) => keep.add(n));
  for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
  console.log(`  groups: ${[...groups.keys()].join(', ')}`);

  await doc.transform(unpartition(), prune({ keepLeaves: false }), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), weld());
  const total = root.listMeshes().reduce((a, m) => a + tris(m), 0);
  if (total > TARGET_TRIS) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_TRIS / total, error: 0.001 }));
  await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const out = path.resolve('apps/web/public/assets/vehicles', cfg.dir);
  await mkdir(path.join(out, 'exterior'), { recursive: true });
  const main = await io.writeBinary(doc);
  await writeFile(path.join(out, 'exterior', 'eval-exterior.glb'), main);
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.006 }));
  const lod = await io.writeBinary(doc);
  await writeFile(path.join(out, 'exterior', 'eval-exterior-lod.glb'), lod);
  console.log(`  ${Math.round(total / 1000)}k tris → ${(main.byteLength / 1048576).toFixed(1)} MB (LOD ${(lod.byteLength / 1048576).toFixed(1)} MB)`);

  // ---- Manifest --------------------------------------------------------------------------
  const L = cfg.length, H = cfg.height, W = cfg.width, k = L / 4.985;
  const v = (x: number, y: number, z: number): [number, number, number] => [x * k, y * (H / 1.9), z * (W / 1.98)];
  const has = (g: string) => groups.has(g);
  const wheels = ['FL', 'FR', 'RL', 'RR'].map((c) => `wheel_${c}`).filter(has);
  const NOTE = `Гуравдагч этгээдийн 3D загвар (${cfg.licence}); гарал үүсэл нь баталгаажаагүй, нарийн хэсгүүд нь жинхэнэ машинаас ялгаатай байж болно.`;
  const components: ComponentMapping[] = [
    { id: 'body_shell', system: 'exterior', nodes: ['body_shell'], note: NOTE },
    ...(wheels.length ? [{ id: 'wheels', system: 'exterior' as const, nodes: wheels, note: NOTE, explode: { offset: [0, 0, 0.9] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], delay: 0.1, mirror: true } }] : []),
    ...(has('windows') ? [{ id: 'windows', system: 'exterior' as const, nodes: ['windows'], note: NOTE, explode: { offset: [0, 0.6, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], delay: 0.3, mirror: false } }] : []),
    ...(has('headlights') ? [{ id: 'headlights', system: 'exterior' as const, nodes: ['headlights'], note: NOTE, explode: { offset: [0.6, 0.1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], delay: 0.2, mirror: false } }] : []),
    ...(has('taillights') ? [{ id: 'taillights', system: 'exterior' as const, nodes: ['taillights'], note: NOTE, explode: { offset: [-0.6, 0.1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], delay: 0.2, mirror: false } }] : []),
  ];
  const E = { exterior: 1 };
  const kf = (at: number, position: [number, number, number], target: [number, number, number], explode: Record<string, number>, opacity: Record<string, number>, fov = 32): Keyframe =>
    ({ at, camera: { position, target, fov }, explode, opacity, yaw: 0 });
  const keyframes: Keyframe[] = [
    kf(0, v(7.2, 2.0, 6.4), v(0, 0.85, 0), {}, E),
    kf(0.5, v(-3.2, 1.5, 7.4), v(0, 0.9, 0), {}, E),
    kf(0.92, v(5.4, 1.2, -3.8), v(1.1, 0.85, 0), {}, E),
    kf(1.15, v(8.6, 4.3, 7.6), v(0, 0.9, 0), {}, E, 34),
    kf(1.85, v(8.2, 4.2, 8.6), v(0, 0.95, 0), { exterior: 1 }, E, 34),
    kf(2.15, v(-0.15, 1.38, 0.0), v(1.0, 1.1, -0.2), {}, E, 64),
    kf(2.6, v(-0.1, 1.36, 0.05), v(1.0, 1.1, 0.2), {}, E, 64),
    kf(3.2, v(7.6, 1.7, -5.4), v(0, 0.85, 0), {}, E),
    kf(4, v(6.8, 2.1, 6.1), v(0, 0.85, 0), {}, E),
  ];
  const manifest = VehicleManifest.parse({
    schemaVersion: 1, vehicleSlug: cfg.slug, assetStatus: 'evaluation', units: 'meters',
    disclaimer: `Гуравдагч этгээдийн туршилтын 3D загвар (Sketchfab, ${cfg.licence}). Гарал үүсэл нь баталгаажаагүй тул зөвхөн дотоод танилцуулгад — арилжаанд ашиглахаас өмнө лицензтэй загвараар солих шаардлагатай.`,
    assets: { exterior: { url: 'exterior/eval-exterior.glb', lodUrl: 'exterior/eval-exterior-lod.glb', draco: true, ktx2: false, bytes: main.byteLength } },
    materialGroups: [
      ...(paintMats.length ? [{ id: 'body', label: 'Их биеийн өнгө', materials: ['mat_body'], surface: 'exterior' as const, default: { hex: defaults.get('mat_body')!, metalness: 0.5, roughness: 0.3, clearcoat: 1 } }] : []),
      ...(roofMats.length ? [{ id: 'roof', label: 'Дээврийн өнгө', materials: ['mat_roof'], surface: 'exterior' as const, default: { hex: defaults.get('mat_roof')!, metalness: 0.5, roughness: 0.3, clearcoat: 1 } }] : []),
    ],
    switches: [],
    components,
    story: {
      sections: [
        { id: 'exterior', index: '01', kicker: 'Гадна тал', title: 'Хэлбэр бүрт илэрх хүч', body: 'Их биеийг тойрон харж, хэсэг бүрийг сонгон дэлгэрэнгүйг үзээрэй.', interactiveSystems: ['exterior'], requires: ['exterior'] },
        { id: 'exploded', index: '02', kicker: 'Задалсан', title: 'Дугуй, шил, гэрэл', body: 'Доош гүйлгэхэд дугуй, шил, гэрлүүд салж харагдана. Буцааж гүйлгэхэд угсрагдана.', interactiveSystems: ['exterior'], requires: ['exterior'] },
        { id: 'interior', index: '03', kicker: 'Салон', title: 'Салон руу орж үзээрэй', body: 'Жолоочийн суудлын өнцгөөс хянах самбар, дэлгэц, суудлыг харна уу.', interactiveSystems: [], requires: ['exterior'] },
        { id: 'final', index: '04', kicker: 'Бүрэн', title: 'Өөрийнхөөрөө тохируулаарай', body: 'Өнгөө сонгож, үнийн санал авахаар тохируулагч руу орно уу.', interactiveSystems: ['exterior'], requires: ['exterior'] },
      ],
      keyframes,
    },
    hero: { position: v(7.4, 1.25, 6.6), target: v(0, 0.05, 0), fov: 30 },
    configurator: { position: v(6.2, 1.9, 6.0), target: v(0, 0.8, 0), fov: 30 },
    cameras: { interior: { position: v(-0.1, 1.4, 0.02), target: v(0.9, 1.15, -0.2), fov: 64 } },
    cabin: { min: v(-2.3, 0.6, -0.85), max: v(1.0, 1.85, 0.85) },
    credits: [cfg.credit],
  });
  const problems = lintManifest(manifest);
  if (problems.length) throw new Error(problems.join('\n'));
  await writeFile(path.join(out, 'vehicle.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOWCASE)) await run(SHOWCASE[id]!);
