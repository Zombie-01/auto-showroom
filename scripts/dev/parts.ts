import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]!);
const groups = new Map<string, { min: number[]; max: number[]; n: number; tris: number; mats: Set<string> }>();
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const key = node.getName().replace(/^T:/, '').replace(/^(S[KM]_[A-Za-z_]+?_101(_001)?)_.*$/, '$1');
  const b = getBounds(node);
  const g = groups.get(key) ?? { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], n: 0, tris: 0, mats: new Set() };
  for (let i = 0; i < 3; i++) { g.min[i] = Math.min(g.min[i]!, b.min[i]!); g.max[i] = Math.max(g.max[i]!, b.max[i]!); }
  g.n++; for (const p of mesh.listPrimitives()) { g.tris += (p.getIndices()?.getCount() ?? 0) / 3; g.mats.add(p.getMaterial()?.getName() ?? '-'); }
  groups.set(key, g);
}
const f = (v: number[]) => v.map((x) => (x * 100).toFixed(2).padStart(7)).join(' ');
for (const [k, g] of [...groups].sort()) console.log(k.padEnd(26), 'c', f(g.min.map((m, i) => (m + g.max[i]!) / 2)), ' size', f(g.max.map((m, i) => m - g.min[i]!)), g.n, Math.round(g.tris), [...g.mats].join(','));
