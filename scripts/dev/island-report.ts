// Report islands (vehicle space) for meshes whose node name matches a regex.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { islands } from '../lib/islands';
const [file, pattern, minTris = '40'] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file!);
// LC300 source → vehicle space (see import-lc300.ts): rotY(90°)·scale(100), x −0.14
const norm = new THREE.Matrix4().makeTranslation(-0.14, 0, 0).multiply(new THREE.Matrix4().makeScale(100, 100, 100)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
for (const n of doc.getRoot().listNodes()) {
  if (!n.getMesh() || !new RegExp(pattern!).test(n.getName())) continue;
  const w = norm.clone().multiply(new THREE.Matrix4().fromArray(n.getWorldMatrix() as unknown as number[]));
  for (const p of n.getMesh()!.listPrimitives()) {
    const isl = islands(p, w).filter((i) => i.count >= Number(minTris)).sort((a, b) => b.count - a.count);
    console.log(`## ${n.getName().slice(0, 70)} [${p.getMaterial()?.getName()}] islands≥${minTris}: ${isl.length}`);
    for (const i of isl.slice(0, 30)) { const s = i.box.getSize(new THREE.Vector3()); console.log('   c', i.centre.toArray().map((x) => x.toFixed(2).padStart(6)).join(''), ' s', s.toArray().map((x) => x.toFixed(2).padStart(5)).join(''), String(i.count).padStart(6)); }
  }
}
