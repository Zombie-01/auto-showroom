import { NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const [file, parent] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file!);
const p = doc.getRoot().listNodes().find((n) => n.getName() === parent)!;
const tris = (n: Node) => { let t = 0; n.traverse((c) => { for (const pr of c.getMesh()?.listPrimitives() ?? []) t += (pr.getIndices()?.getCount() ?? 0) / 3; }); return t; };
const all = getBounds(p);
console.log('ALL min', all.min.map((v) => v.toFixed(3)), 'max', all.max.map((v) => v.toFixed(3)));
for (const c of p.listChildren()) {
  const b = getBounds(c);
  const ctr = [0, 1, 2].map((i) => ((b.min[i]! + b.max[i]!) / 2).toFixed(3)), s = [0, 1, 2].map((i) => (b.max[i]! - b.min[i]!).toFixed(3));
  console.log(c.getName().padEnd(36), 'c', ctr.join(' ').padEnd(24), 'size', s.join(' ').padEnd(22), Math.round(tris(c)));
}
