import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('incoming/lc300/model.glb');
// normalised: x = 100*z - 0.14 (forward), y = 100*y, z = -100*x (right)
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  const name = n.getName();
  if (!/SM_Body_101|SK_Body_Bones|SK_Door|SK_Trunk/.test(name)) continue;
  const b = getBounds(n);
  const c = [0, 1, 2].map((i) => (b.min[i]! + b.max[i]!) / 2 * 100), s = [0, 1, 2].map((i) => (b.max[i]! - b.min[i]!) * 100);
  const mat = m.listPrimitives()[0]!.getMaterial()!.getName();
  const tris = m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(name.replace(/^T:(S[KM]_[A-Za-z_]+?_101(_001)?)_.*_(\d+)_T:.*/, '$1#$3').padEnd(30), mat.padEnd(26),
    'c(x,y,z)', [c[2]! - 0.14, c[1]!, -c[0]!].map((v) => v.toFixed(2).padStart(6)).join(''), ' size', [s[2]!, s[1]!, s[0]!].map((v) => v.toFixed(2).padStart(5)).join(''), String(Math.round(tris)).padStart(6));
}
