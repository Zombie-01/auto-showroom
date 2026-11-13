import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]!);
const area = new Map<string, number>();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), el: number[] = [];
for (const n of doc.getRoot().listNodes()) {
  const w = new THREE.Matrix4().fromArray(n.getWorldMatrix() as unknown as number[]);
  for (const p of n.getMesh()?.listPrimitives() ?? []) {
    const pos = p.getAttribute('POSITION')!, idx = p.getIndices(); const cnt = idx ? idx.getCount() : pos.getCount();
    let s = 0;
    for (let t = 0; t + 2 < cnt; t += 3) {
      pos.getElement(idx ? idx.getScalar(t) : t, el); a.set(el[0]!, el[1]!, el[2]!).applyMatrix4(w);
      pos.getElement(idx ? idx.getScalar(t + 1) : t + 1, el); b.set(el[0]!, el[1]!, el[2]!).applyMatrix4(w);
      pos.getElement(idx ? idx.getScalar(t + 2) : t + 2, el); c.set(el[0]!, el[1]!, el[2]!).applyMatrix4(w);
      s += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    const k = p.getMaterial()?.getName() ?? '-'; area.set(k, (area.get(k) ?? 0) + s);
  }
}
const tot = [...area.values()].reduce((x, y) => x + y, 0);
for (const [k, v] of [...area].sort((x, y) => y[1] - x[1]).slice(0, 12)) { const m = doc.getRoot().listMaterials().find((x) => x.getName() === k); console.log(k.padEnd(28), (100 * v / tot).toFixed(1).padStart(5) + '%', m?.getBaseColorFactor().map((x) => x.toFixed(2)).join('/'), m?.getBaseColorTexture() ? 'tex' : ''); }
