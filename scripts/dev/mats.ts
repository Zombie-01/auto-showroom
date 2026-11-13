import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]!);
const use = new Map<string, { n: number; nodes: Set<string> }>();
for (const node of doc.getRoot().listNodes()) for (const p of node.getMesh()?.listPrimitives() ?? []) {
  const k = p.getMaterial()?.getName() ?? '-'; const u = use.get(k) ?? { n: 0, nodes: new Set() };
  u.n += (p.getIndices()?.getCount() ?? 0) / 3; u.nodes.add(node.getName().slice(0, 28)); use.set(k, u);
}
for (const m of doc.getRoot().listMaterials()) {
  const u = use.get(m.getName()); const c = m.getBaseColorFactor().map((x) => x.toFixed(2)).join('/');
  console.log(m.getName().padEnd(30), c.padEnd(22), m.getAlphaMode().padEnd(6), m.getBaseColorTexture() ? 'tex' : '   ', String(Math.round(u?.n ?? 0)).padStart(7), [...(u?.nodes ?? [])].slice(0, 3).join(', '));
}
