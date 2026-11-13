import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]!);
const re = new RegExp(process.argv[3] ?? '.');
for (const n of doc.getRoot().listNodes()) for (const p of n.getMesh()?.listPrimitives() ?? []) {
  const mat = p.getMaterial()?.getName() ?? '';
  if (!re.test(mat) && !re.test(n.getName())) continue;
  const col = p.getAttribute('COLOR_0');
  let avg = '-';
  if (col) { const el: number[] = []; const s = [0, 0, 0]; const c = col.getCount(); for (let i = 0; i < c; i += 7) { col.getElement(i, el); s[0] += el[0]!; s[1] += el[1]!; s[2] += el[2]!; } avg = s.map((x) => (x / Math.ceil(c / 7)).toFixed(2)).join('/'); }
  const b = getBounds(n); const sz = [0, 1, 2].map((i) => (b.max[i]! - b.min[i]!).toFixed(2)).join('x');
  console.log(n.getName().slice(0, 24).padEnd(24), mat.slice(0, 34).padEnd(34), 'COLOR_0', avg.padEnd(16), 'tris', Math.round((p.getIndices()?.getCount() ?? 0) / 3), 'size', sz, 'scale', n.getScale().map((x) => x.toFixed(2)).join(','));
}
